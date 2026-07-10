import { prisma, creditDeposit, type PrismaClient } from "@tradynance/core";

export interface DetectedTransfer {
  network: string;
  txHash: string;
  txOutputIndex: number;
  toAddress: string;
  fromAddress?: string;
  /** Human-readable amount in the asset's main unit (e.g. "0.5" BTC), as a string. */
  amount: string;
  confirmations: number;
}

/**
 * Idempotently record one detected on-chain transfer and credit it once it has enough
 * confirmations. Safe to call repeatedly for the same transfer across polls — the
 * (network, txHash, txOutputIndex) unique constraint dedups the Deposit row, and
 * creditDeposit is itself idempotent.
 *
 * Returns true if this call performed the credit (for logging), false otherwise.
 */
export async function recordAndMaybeCredit(
  transfer: DetectedTransfer,
  minConfirmations: number,
): Promise<boolean> {
  // Match the transfer to a provisioned wallet by its deposit address + network.
  const wallet = await prisma.wallet.findFirst({
    where: { network: transfer.network, depositAddress: transfer.toAddress },
    select: { id: true, userId: true, assetId: true },
  });
  if (!wallet) return false; // address isn't one of ours

  const confirmed = transfer.confirmations >= minConfirmations;

  // Upsert the deposit (idempotent on the unique detection key). The `update` clause must
  // NEVER touch `status` — doing so would downgrade an already-CREDITED deposit and let the
  // next poll credit it a second time. The status lifecycle is owned entirely by
  // creditDeposit (which sets CREDITED) and the admin reject flow (which sets REJECTED);
  // here we only ever advance the confirmation count.
  const deposit = await prisma.deposit.upsert({
    where: {
      network_txHash_txOutputIndex: {
        network: transfer.network,
        txHash: transfer.txHash,
        txOutputIndex: transfer.txOutputIndex,
      },
    },
    create: {
      userId: wallet.userId,
      assetId: wallet.assetId,
      network: transfer.network,
      amount: transfer.amount,
      txHash: transfer.txHash,
      txOutputIndex: transfer.txOutputIndex,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      confirmations: transfer.confirmations,
      status: confirmed ? "CONFIRMED" : "PENDING",
      source: "CHAIN",
    },
    update: {
      confirmations: transfer.confirmations,
    },
  });

  // creditDeposit is itself idempotent (no-op on an already-CREDITED deposit), so this is
  // safe even if the upsert returned a stale in-flight status.
  if (confirmed && deposit.status !== "CREDITED" && deposit.status !== "REJECTED") {
    const result = await creditDeposit(prisma as PrismaClient, { depositId: deposit.id });
    return result.credited;
  }
  return false;
}
