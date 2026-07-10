import { createPublicClient, http, formatEther, getAddress } from "viem";
import { sepolia } from "viem/chains";

import { prisma } from "@tradynance/core";
import { config } from "./config.js";
import { recordAndMaybeCredit, type DetectedTransfer } from "./deposits.js";

const client = createPublicClient({
  chain: sepolia,
  transport: http(config.eth.rpcUrl),
});

// In-memory checkpoint of the last block we've scanned. On restart we fall back to
// (tip - lookback). Because deposits are idempotent, re-scanning is harmless — this just
// avoids re-fetching the whole lookback window every single poll.
//
// TESTNET-MVP LIMITATION (documented, not a silent gap): this native-ETH watcher scans block
// bodies for transactions whose `to` is one of our addresses. It does NOT handle chain
// reorgs or ERC-20 token transfers (USDT/USDC/LINK on Sepolia) — those need log-based
// scanning and a persistent, reorg-aware checkpoint. Out of scope for this phase.
let lastScannedBlock: bigint | null = null;

export async function scanEvm(): Promise<void> {
  const addresses = await loadWatchedAddresses();
  if (addresses.size === 0) return;

  const tip = await client.getBlockNumber();
  const lookback = BigInt(config.eth.lookbackBlocks);
  const from =
    lastScannedBlock === null
      ? tip - lookback + 1n
      : // re-scan a small overlap so a block that was mid-produced isn't missed
        lastScannedBlock - 1n < tip - lookback
        ? tip - lookback + 1n
        : lastScannedBlock - 1n;

  for (let n = from > 0n ? from : 0n; n <= tip; n++) {
    let block;
    try {
      block = await client.getBlock({ blockNumber: n, includeTransactions: true });
    } catch (err) {
      console.error(`[eth] failed to fetch block ${n}:`, (err as Error).message);
      return; // stop this pass; don't advance the checkpoint past a gap
    }

    for (const tx of block.transactions) {
      if (typeof tx === "string" || !tx.to || tx.value === 0n) continue;
      const to = safeChecksum(tx.to);
      if (!to || !addresses.has(to)) continue;

      const transfer: DetectedTransfer = {
        network: config.eth.network,
        txHash: tx.hash,
        txOutputIndex: 0, // native transfer: one value per tx
        toAddress: to,
        fromAddress: tx.from ? safeChecksum(tx.from) ?? undefined : undefined,
        amount: formatEther(tx.value),
        confirmations: Number(tip - n + 1n),
      };
      await handle(transfer);
    }
  }

  lastScannedBlock = tip;
}

async function loadWatchedAddresses(): Promise<Set<string>> {
  const wallets = await prisma.wallet.findMany({
    where: { network: config.eth.network, depositAddress: { not: null } },
    select: { depositAddress: true },
  });
  const set = new Set<string>();
  for (const w of wallets) {
    const checksummed = safeChecksum(w.depositAddress!);
    if (checksummed) set.add(checksummed);
  }
  return set;
}

function safeChecksum(address: string): string | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

async function handle(transfer: DetectedTransfer): Promise<void> {
  try {
    const credited = await recordAndMaybeCredit(transfer, config.eth.minConfirmations);
    if (credited) {
      console.log(
        `[eth] credited ${transfer.amount} ETH to ${transfer.toAddress} (tx ${transfer.txHash})`,
      );
    }
  } catch (err) {
    console.error(`[eth] error handling ${transfer.txHash}:`, (err as Error).message);
  }
}
