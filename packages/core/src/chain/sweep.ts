// Deposit sweeping — custody consolidation. Deposits land on per-user HD-derived addresses (which
// let the chain-watcher attribute + credit them). Those coins physically sit at each user's
// address; this sweeper moves them into the platform treasury/hot wallet (which also pays
// withdrawals), closing the custody loop.
//
// Crucially: sweeping is NOT a balance change. The user was already credited when the deposit was
// detected, so a sweep writes NO LedgerEntry — it only moves custody and records a Sweep row for
// the ops/audit trail. The ledger invariant is untouched.
//
// EVM (Sepolia) only for now — BTC UTXO/PSBT sweeping is deferred, like BTC withdrawal broadcast.
// TESTNET ONLY (convention #5): needs the derived deposit addresses to actually hold testnet ETH.

import { createPublicClient, createWalletClient, http, formatEther, isAddress, type Hex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import { hotEvmAccount } from "./evm-withdraw.js";

const D = Prisma.Decimal;
const SWEEP_NETWORK = "ETH_SEPOLIA";
const GAS_LIMIT = BigInt(21_000); // a plain native transfer

export interface SweepResult {
  scanned: number;
  swept: number;
  treasury: string;
  entries: { userId: string | null; from: string; amountEth: string; txHash: string }[];
}

export async function sweepEvmDeposits(
  prisma: PrismaClient,
  opts?: { rpcUrl?: string },
): Promise<SweepResult> {
  const mnemonic = process.env.HD_WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("HD_WALLET_MNEMONIC is not set");
  const rpcUrl = opts?.rpcUrl ?? process.env.ETH_SEPOLIA_RPC_URL;
  const treasury = hotEvmAccount().address;

  const wallets = await prisma.wallet.findMany({
    where: { network: SWEEP_NETWORK, depositAddress: { not: null }, derivationIndex: { not: null } },
    select: { userId: true, depositAddress: true, derivationIndex: true },
  });

  const pub = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const gasPrice = await pub.getGasPrice();
  const gasCost = gasPrice * GAS_LIMIT;
  const dustFloor = gasCost * BigInt(2); // ignore balances that barely cover the sweep's own gas

  const entries: SweepResult["entries"] = [];
  for (const w of wallets) {
    const from = w.depositAddress!;
    if (!isAddress(from) || from.toLowerCase() === treasury.toLowerCase()) continue;

    const bal = await pub.getBalance({ address: from as Hex });
    if (bal <= gasCost + dustFloor) continue; // nothing worth sweeping

    // Re-derive the signing key for this index and confirm it controls `from` before spending.
    const account = mnemonicToAccount(mnemonic, { addressIndex: w.derivationIndex! });
    if (account.address.toLowerCase() !== from.toLowerCase()) {
      console.error(`[sweep] derived ${account.address} != stored ${from} (idx ${w.derivationIndex}); skipping`);
      continue;
    }

    const value = bal - gasCost; // sweep the whole balance, leaving exactly the gas
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
    const txHash = await walletClient.sendTransaction({
      to: treasury as Hex,
      value,
      gas: GAS_LIMIT,
      gasPrice,
    });

    await prisma.sweep.create({
      data: {
        network: SWEEP_NETWORK,
        userId: w.userId,
        fromAddress: from,
        toAddress: treasury,
        amount: new D(formatEther(value)),
        txHash,
      },
    });
    entries.push({ userId: w.userId, from, amountEth: formatEther(value), txHash });
  }

  return { scanned: wallets.length, swept: entries.length, treasury, entries };
}
