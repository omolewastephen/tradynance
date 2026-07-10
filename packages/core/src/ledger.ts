// The one place money enters a user's balance. Both the Next.js app (manual admin confirm)
// and the standalone chain-watcher call `creditDeposit` so the money-correctness invariant
// (CLAUDE.md hard convention #3) can't drift between the two processes.
//
// Invariant enforced here:
//   - Wallet.balance is a CACHE. The source of truth is the LedgerEntry rows.
//   - Every credit writes ONE append-only LedgerEntry and bumps the cached balance in the
//     SAME transaction. If the process dies between them, neither happened.
//   - Crediting is IDEMPOTENT per Deposit: a Deposit already in CREDITED state is a no-op,
//     so a watcher re-scan or a double admin click can't inflate a balance.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";

export interface CreditDepositInput {
  depositId: string;
  /** Who performed a manual credit, if any (null for automated chain credits). */
  actorId?: string | null;
}

export interface CreditDepositResult {
  credited: boolean; // false = was already credited (idempotent no-op)
  walletId: string;
  newBalance: string;
}

/**
 * Credit a pending/confirmed Deposit to its owner's wallet, atomically and idempotently.
 * Safe to call more than once for the same deposit.
 */
export async function creditDeposit(
  prisma: PrismaClient,
  input: CreditDepositInput,
): Promise<CreditDepositResult> {
  return prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.findUniqueOrThrow({
      where: { id: input.depositId },
    });

    if (deposit.status === "CREDITED") {
      // Already applied — return the current wallet balance without touching anything.
      const wallet = await tx.wallet.findFirstOrThrow({
        where: {
          userId: deposit.userId,
          assetId: deposit.assetId,
          network: deposit.network,
        },
      });
      return {
        credited: false,
        walletId: wallet.id,
        newBalance: wallet.balance.toString(),
      };
    }

    if (deposit.status === "REJECTED") {
      throw new Error(`Deposit ${deposit.id} is REJECTED and cannot be credited`);
    }

    const wallet = await tx.wallet.findFirstOrThrow({
      where: {
        userId: deposit.userId,
        assetId: deposit.assetId,
        network: deposit.network,
      },
    });

    const newBalance = new Prisma.Decimal(wallet.balance).plus(deposit.amount);

    // 1) append-only ledger row (source of truth)
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        userId: deposit.userId,
        assetId: deposit.assetId,
        type: "DEPOSIT",
        status: "CONFIRMED",
        amount: deposit.amount, // positive = credit
        balanceAfter: newBalance,
        referenceType: "Deposit",
        referenceId: deposit.id,
        note: input.actorId ? `manual credit by ${input.actorId}` : null,
      },
    });

    // 2) update the cached balance
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    // 3) mark the deposit credited
    await tx.deposit.update({
      where: { id: deposit.id },
      data: { status: "CREDITED", creditedAt: new Date() },
    });

    return {
      credited: true,
      walletId: wallet.id,
      newBalance: newBalance.toString(),
    };
  });
}
