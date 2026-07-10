import { prisma } from "@tradynance/core";
import { config } from "./config.js";
import { recordAndMaybeCredit, type DetectedTransfer } from "./deposits.js";

// Esplora address-tx shape (only the fields we use).
interface EsploraVout {
  scriptpubkey_address?: string;
  value: number; // satoshis
}
interface EsploraTx {
  txid: string;
  vout: EsploraVout[];
  status: { confirmed: boolean; block_height?: number };
}

const SATS_PER_BTC = 100_000_000;

async function esplora<T>(path: string): Promise<T> {
  const res = await fetch(`${config.btc.esploraUrl}${path}`);
  if (!res.ok) {
    throw new Error(`esplora ${path} -> ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * One BTC-testnet polling pass: for every provisioned BTC address, ask esplora for its
 * transactions and record any outputs paying that address.
 */
export async function scanBtc(): Promise<void> {
  const wallets = await prisma.wallet.findMany({
    where: { network: config.btc.network, depositAddress: { not: null } },
    select: { depositAddress: true },
  });
  if (wallets.length === 0) return;

  const tipHeight = await esplora<number>("/blocks/tip/height");

  for (const wallet of wallets) {
    const address = wallet.depositAddress!;
    let txs: EsploraTx[];
    try {
      txs = await esplora<EsploraTx[]>(`/address/${address}/txs`);
    } catch (err) {
      console.error(`[btc] failed to fetch txs for ${address}:`, (err as Error).message);
      continue;
    }

    for (const tx of txs) {
      const confirmations =
        tx.status.confirmed && tx.status.block_height
          ? tipHeight - tx.status.block_height + 1
          : 0;

      tx.vout.forEach((out, index) => {
        if (out.scriptpubkey_address !== address) return;
        const transfer: DetectedTransfer = {
          network: config.btc.network,
          txHash: tx.txid,
          txOutputIndex: index,
          toAddress: address,
          amount: (out.value / SATS_PER_BTC).toFixed(8),
          confirmations,
        };
        void handle(transfer);
      });
    }
  }
}

async function handle(transfer: DetectedTransfer): Promise<void> {
  try {
    const credited = await recordAndMaybeCredit(transfer, config.btc.minConfirmations);
    if (credited) {
      console.log(
        `[btc] credited ${transfer.amount} BTC to ${transfer.toAddress} (tx ${transfer.txHash})`,
      );
    }
  } catch (err) {
    console.error(`[btc] error handling ${transfer.txHash}:`, (err as Error).message);
  }
}
