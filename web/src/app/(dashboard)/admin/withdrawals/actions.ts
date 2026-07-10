"use server";

import { revalidatePath } from "next/cache";

import { settleWithdrawal, releaseWithdrawal, type PrismaClient } from "@tradynance/core";
import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"] as const;

export type AdminWithdrawalResult = { ok: true } | { ok: false; error: string };

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
  revalidatePath("/admin/withdrawals");
  return { ok: true };
}
