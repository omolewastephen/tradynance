// Withdrawal money movement — the debit side of the ledger, kept as disciplined as
// creditDeposit (see ledger.ts). Model: RESERVE → SETTLE, with RELEASE on rejection/cancel.
//
//   reserveFunds:  available (balance − locked) must cover amount+fee. We increase
//                  lockedBalance by amount+fee. NO ledger entry and NO balance change yet —
//                  the money hasn't left, it's just held so it can't be double-spent.
//   settle:        the funds actually leave. ONE append-only WITHDRAWAL ledger entry for
//                  −(amount+fee), balance −= amount+fee, lockedBalance −= amount+fee, all in
//                  one transaction. Idempotent: a COMPLETED withdrawal is a no-op.
//   release:       reject/cancel a locked-but-not-settled withdrawal — lockedBalance −=
//                  amount+fee, no ledger entry (no money moved). Idempotent.
//
// Because balance is the cache and LedgerEntry is the source of truth, a settled withdrawal
// leaves exactly one negative ledger row; a rejected one leaves none. `available` on the
// wallet is always balance − lockedBalance.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";

export class InsufficientFundsError extends Error {
  constructor(
    public available: string,
    public required: string,
  ) {
    super(`Insufficient available balance: have ${available}, need ${required}`);
    this.name = "InsufficientFundsError";
  }
}

/**
 * Reserve funds for a confirmed withdrawal: locks amount+fee against the wallet after
 * checking available balance, and flips the withdrawal to PENDING (awaiting admin approval).
 * Atomic — the available-balance check and the lock happen in one transaction, so two
 * concurrent confirmations can't both pass.
 */
export async function reserveWithdrawalFunds(
  prisma: PrismaClient,
  withdrawalId: string,
): Promise<{ locked: string }> {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });

    if (withdrawal.status !== "AWAITING_CONFIRMATION") {
      // Already reserved (PENDING) or beyond — treat as a no-op so a double-confirm is safe.
      const wallet = await walletFor(tx, withdrawal);
      return { locked: wallet.lockedBalance.toString() };
    }

    const wallet = await walletFor(tx, withdrawal);
    const total = new Prisma.Decimal(withdrawal.amount).plus(withdrawal.fee);
    const available = new Prisma.Decimal(wallet.balance).minus(wallet.lockedBalance);
    if (available.lessThan(total)) {
      throw new InsufficientFundsError(available.toString(), total.toString());
    }

    const newLocked = new Prisma.Decimal(wallet.lockedBalance).plus(total);
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { lockedBalance: newLocked },
    });
    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "PENDING", confirmedAt: new Date() },
    });
    return { locked: newLocked.toString() };
  });
}

/**
 * Settle a withdrawal: the funds actually leave the account. Idempotent — a COMPLETED
 * withdrawal returns without touching anything.
 */
export async function settleWithdrawal(
  prisma: PrismaClient,
  input: { withdrawalId: string; txHash?: string; actorId?: string | null },
): Promise<{ settled: boolean; newBalance: string }> {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUniqueOrThrow({
      where: { id: input.withdrawalId },
    });
    const wallet = await walletFor(tx, withdrawal);

    if (withdrawal.status === "COMPLETED") {
      return { settled: false, newBalance: wallet.balance.toString() };
    }
    if (!["PENDING", "APPROVED", "PROCESSING"].includes(withdrawal.status)) {
      throw new Error(
        `Withdrawal ${withdrawal.id} cannot be settled from status ${withdrawal.status}`,
      );
    }

    const total = new Prisma.Decimal(withdrawal.amount).plus(withdrawal.fee);
    const newBalance = new Prisma.Decimal(wallet.balance).minus(total);
    const newLocked = Prisma.Decimal.max(
      new Prisma.Decimal(wallet.lockedBalance).minus(total),
      0,
    );

    // append-only ledger row (source of truth) — negative = debit, covers amount + fee
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        userId: withdrawal.userId,
        assetId: withdrawal.assetId,
        type: "WITHDRAWAL",
        status: "CONFIRMED",
        amount: total.negated(),
        balanceAfter: newBalance,
        referenceType: "Withdrawal",
        referenceId: withdrawal.id,
        note: input.actorId ? `approved by ${input.actorId}` : null,
      },
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance, lockedBalance: newLocked },
    });
    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: "COMPLETED",
        approvedById: input.actorId ?? undefined,
        approvedAt: new Date(),
        txHash: input.txHash ?? undefined,
      },
    });

    return { settled: true, newBalance: newBalance.toString() };
  });
}

/**
 * Release a reserved-but-unsettled withdrawal (admin reject or user cancel): unlock the
 * held funds without moving money. Idempotent — a terminal withdrawal is a no-op.
 */
export async function releaseWithdrawal(
  prisma: PrismaClient,
  input: {
    withdrawalId: string;
    status: "REJECTED" | "CANCELLED";
    reason?: string;
    actorId?: string | null;
  },
): Promise<{ released: boolean }> {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUniqueOrThrow({
      where: { id: input.withdrawalId },
    });

    if (["COMPLETED", "REJECTED", "CANCELLED"].includes(withdrawal.status)) {
      return { released: false }; // terminal — nothing to unlock
    }

    // Funds are only locked once confirmed (PENDING+). AWAITING_CONFIRMATION never locked.
    if (["PENDING", "APPROVED", "PROCESSING"].includes(withdrawal.status)) {
      const wallet = await walletFor(tx, withdrawal);
      const total = new Prisma.Decimal(withdrawal.amount).plus(withdrawal.fee);
      const newLocked = Prisma.Decimal.max(
        new Prisma.Decimal(wallet.lockedBalance).minus(total),
        0,
      );
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { lockedBalance: newLocked },
      });
    }

    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: input.status,
        rejectedReason: input.reason ?? undefined,
        approvedById: input.actorId ?? undefined,
      },
    });
    return { released: true };
  });
}

// Withdrawal rows don't carry a walletId, so resolve the wallet by (user, asset, network).
async function walletFor(
  tx: Prisma.TransactionClient,
  withdrawal: { userId: string; assetId: string; network: string },
) {
  return tx.wallet.findFirstOrThrow({
    where: {
      userId: withdrawal.userId,
      assetId: withdrawal.assetId,
      network: withdrawal.network,
    },
  });
}
