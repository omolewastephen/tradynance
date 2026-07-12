"use server";

import { revalidatePath } from "next/cache";

import {
  settleWithdrawal,
  releaseWithdrawal,
  broadcastWithdrawal,
  notify,
  type PrismaClient,
} from "@tradynance/core";
import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { captureException } from "@/lib/observability";

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
 * Approve + settle a withdrawal, then debit through the shared idempotent settleWithdrawal path.
 *
 * If the admin supplies `txHash`, it's the MANUAL path (the send happened out of band — e.g. BTC,
 * whose broadcast isn't implemented). Otherwise, for a broadcastable network (ETH Sepolia) we
 * sign + broadcast on-chain FIRST (funds stay locked), persist the real hash, and only then settle
 * the ledger — so we never debit without a confirmed send, and never leave a sent-but-unrecorded
 * withdrawal. If broadcast fails (e.g. hot wallet unfunded), nothing is debited and the admin can
 * retry or settle manually.
 */
export async function approveWithdrawal(
  withdrawalId: string,
  txHash?: string,
): Promise<AdminWithdrawalResult> {
  const session = await requireRole([...FINANCE_ROLES]);

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) return { ok: false, error: "Withdrawal not found" };

  const manualHash = txHash?.trim();
  let settleHash = manualHash || undefined;
  let broadcast = false;

  // No manual hash → attempt a real on-chain broadcast for supported networks.
  if (!manualHash) {
    let result;
    try {
      result = await broadcastWithdrawal({
        network: withdrawal.network,
        to: withdrawal.destinationAddress,
        amount: withdrawal.amount.toString(),
      });
    } catch (e) {
      // Broadcast failed (unfunded hot wallet, RPC error, …): don't touch the ledger.
      captureException(e, { where: "broadcastWithdrawal", withdrawalId, network: withdrawal.network });
      return { ok: false, error: `On-chain broadcast failed: ${(e as Error).message}` };
    }
    if (result.broadcast) {
      settleHash = result.txHash;
      broadcast = true;
      // Persist the hash immediately so a send is never lost even if settlement then fails.
      await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { txHash: result.txHash } });
    } else {
      return {
        ok: false,
        error: `${result.reason} (leave the tx-hash field empty only for networks with automatic broadcast).`,
      };
    }
  }

  try {
    await settleWithdrawal(prisma as PrismaClient, {
      withdrawalId,
      txHash: settleHash,
      actorId: session.user.id,
    });
  } catch (e) {
    if (broadcast) {
      captureException(e, { where: "settleWithdrawal after broadcast", withdrawalId, txHash: settleHash });
    }
    return { ok: false, error: (e as Error).message };
  }
  await recordAudit({
    actorId: session.user.id,
    action: "withdrawal.approve",
    entityType: "Withdrawal",
    entityId: withdrawalId,
    metadata: { txHash: settleHash ?? null, broadcast },
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
  await recordAudit({
    actorId: session.user.id,
    action: "withdrawal.reject",
    entityType: "Withdrawal",
    entityId: withdrawalId,
    metadata: { reason: reason.trim() || null },
  });
  await notifyWithdrawal(withdrawalId, false, reason.trim() || undefined);
  revalidatePath("/admin/withdrawals");
  return { ok: true };
}
