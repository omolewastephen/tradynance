"use server";

import { revalidatePath } from "next/cache";

import {
  settleWithdrawal,
  releaseWithdrawal,
  notify,
  type PrismaClient,
} from "@tradynance/core";
import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"] as const;

export type AdminWithdrawalResult = { ok: true } | { ok: false; error: string };

/** Notify the withdrawal's owner of a status change (post-tx). */
async function notifyWithdrawal(withdrawalId: string, completed: boolean, reason?: string) {
  const w = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { asset: { select: { symbol: true } } },
  });
  if (!w) return;
  await notify(prisma as PrismaClient, {
    userId: w.userId,
    type: "WITHDRAWAL",
    title: completed ? "Withdrawal completed" : "Withdrawal rejected",
    body: completed
      ? `Your withdrawal of ${w.amount.toString()} ${w.asset.symbol} has been processed.`
      : `Your withdrawal of ${w.amount.toString()} ${w.asset.symbol} was rejected${
          reason ? `: ${reason}` : ""
        }. The funds have been released back to your balance.`,
    referenceType: "Withdrawal",
    referenceId: w.id,
  });
}

/**
 * Approve + settle a withdrawal: writes the debit through the shared, idempotent
 * settleWithdrawal path (same ledger discipline as everything else). `txHash` is the
 * on-chain send reference (optional here — actual broadcast is out of scope this phase).
 */
export async function approveWithdrawal(
  withdrawalId: string,
  txHash?: string,
): Promise<AdminWithdrawalResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  try {
    await settleWithdrawal(prisma as PrismaClient, {
      withdrawalId,
      txHash: txHash?.trim() || undefined,
      actorId: session.user.id,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "withdrawal.approve",
      entityType: "Withdrawal",
      entityId: withdrawalId,
      metadata: { txHash: txHash?.trim() || null },
    },
  });
  await notifyWithdrawal(withdrawalId, true);
  revalidatePath("/admin/withdrawals");
  return { ok: true };
}

export async function rejectWithdrawal(
  withdrawalId: string,
  reason: string,
): Promise<AdminWithdrawalResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  await releaseWithdrawal(prisma as PrismaClient, {
    withdrawalId,
    status: "REJECTED",
    reason: reason.trim() || "Rejected by admin",
    actorId: session.user.id,
  });
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "withdrawal.reject",
      entityType: "Withdrawal",
      entityId: withdrawalId,
      metadata: { reason: reason.trim() || null },
    },
  });
  await notifyWithdrawal(withdrawalId, false, reason.trim() || undefined);
  revalidatePath("/admin/withdrawals");
  return { ok: true };
}
