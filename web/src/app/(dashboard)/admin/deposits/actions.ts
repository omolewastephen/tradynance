"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { creditDeposit, notify, type PrismaClient } from "@tradynance/core";
import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getOrCreateWallet } from "@/lib/wallet";

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"] as const;

const manualCreditSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  assetSymbol: z.string().trim().toUpperCase(),
  network: z.string().trim(),
  amount: z
    .string()
    .trim()
    .refine((v) => Number(v) > 0, "Amount must be positive"),
  note: z.string().trim().max(200).optional(),
});

export type ManualCreditResult = { ok: true; newBalance: string } | { ok: false; error: string };

/**
 * Admin fallback: manually create + credit a deposit for a user when automated
 * chain-watching isn't available for that network. Uses the SAME idempotent
 * creditDeposit path as the chain-watcher, so the ledger invariant holds identically.
 */
export async function manualCreditDeposit(formData: FormData): Promise<ManualCreditResult> {
  const session = await requireRole([...FINANCE_ROLES]);

  const parsed = manualCreditSchema.safeParse({
    email: formData.get("email"),
    assetSymbol: formData.get("assetSymbol"),
    network: formData.get("network"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) return { ok: false, error: `No user with email ${input.email}` };

  const asset = await prisma.asset.findUnique({
    where: { symbol: input.assetSymbol },
    include: { networks: true },
  });
  if (!asset) return { ok: false, error: `No asset ${input.assetSymbol}` };
  if (!asset.networks.some((n) => n.network === input.network)) {
    return { ok: false, error: `${input.assetSymbol} has no ${input.network} network` };
  }

  // Ensure the target wallet exists (creates it if needed, no address required).
  await getOrCreateWallet(user.id, asset.id, input.network);

  // Synthetic txHash keeps manual credits from ever colliding with a real on-chain
  // (network, txHash, output) detection key.
  const deposit = await prisma.deposit.create({
    data: {
      userId: user.id,
      assetId: asset.id,
      network: input.network,
      amount: input.amount,
      txHash: `manual:${randomUUID()}`,
      txOutputIndex: 0,
      toAddress: "MANUAL",
      status: "CONFIRMED",
      source: "MANUAL",
    },
  });

  const result = await creditDeposit(prisma as PrismaClient, {
    depositId: deposit.id,
    actorId: session.user.id,
  });

  await recordAudit({
    actorId: session.user.id,
    action: "deposit.manual_credit",
    entityType: "Deposit",
    entityId: deposit.id,
    metadata: {
      email: input.email,
      asset: input.assetSymbol,
      network: input.network,
      amount: input.amount,
      note: input.note ?? null,
    },
  });

  revalidatePath("/admin/deposits");
  return { ok: true, newBalance: result.newBalance };
}

// ── User-submitted deposit claims (Admin review queue) ─────────────────────────────────────

export type ClaimActionResult = { ok: true } | { ok: false; error: string };

/**
 * Approve a user's deposit claim: credits it through the same idempotent creditDeposit path as
 * the chain-watcher + manual credit. The claim row already carries the user, asset, network and
 * amount, so this just moves it PENDING → CREDITED (and is a safe no-op if already credited).
 */
export async function approveDepositClaim(formData: FormData): Promise<ClaimActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);

  const depositId = String(formData.get("depositId") ?? "");
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit || deposit.source !== "CLAIM") return { ok: false, error: "Claim not found" };
  if (deposit.status === "CREDITED") return { ok: false, error: "Already credited" };
  if (deposit.status === "REJECTED") return { ok: false, error: "This claim was rejected" };

  // Ensure the destination wallet exists (it should, from the claim submission).
  await getOrCreateWallet(deposit.userId, deposit.assetId, deposit.network);

  await creditDeposit(prisma as PrismaClient, { depositId: deposit.id, actorId: session.user.id });

  await recordAudit({
    actorId: session.user.id,
    action: "deposit.claim_approve",
    entityType: "Deposit",
    entityId: deposit.id,
    metadata: {
      userId: deposit.userId,
      amount: deposit.amount.toString(),
      network: deposit.network,
      txHash: deposit.txHash,
    },
  });

  revalidatePath("/admin/deposits");
  return { ok: true };
}

/** Reject a user's deposit claim (no money moves) and notify them. */
export async function rejectDepositClaim(formData: FormData): Promise<ClaimActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);

  const depositId = String(formData.get("depositId") ?? "");
  const reason = (formData.get("reason") as string | null)?.trim() || undefined;
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: { asset: { select: { symbol: true } } },
  });
  if (!deposit || deposit.source !== "CLAIM") return { ok: false, error: "Claim not found" };
  if (deposit.status === "CREDITED") return { ok: false, error: "Already credited — cannot reject" };
  if (deposit.status === "REJECTED") return { ok: false, error: "Already rejected" };

  await prisma.deposit.update({ where: { id: deposit.id }, data: { status: "REJECTED" } });

  await notify(prisma as PrismaClient, {
    userId: deposit.userId,
    type: "DEPOSIT",
    title: "Deposit claim not confirmed",
    body: `We couldn't confirm your ${deposit.amount.toString()} ${deposit.asset.symbol} deposit${
      reason ? ` — ${reason}` : ""
    }. Contact support with your transaction ID if you believe this is an error.`,
    referenceType: "Deposit",
    referenceId: deposit.id,
  });

  await recordAudit({
    actorId: session.user.id,
    action: "deposit.claim_reject",
    entityType: "Deposit",
    entityId: deposit.id,
    metadata: {
      userId: deposit.userId,
      amount: deposit.amount.toString(),
      network: deposit.network,
      txHash: deposit.txHash,
      reason: reason ?? null,
    },
  });

  revalidatePath("/admin/deposits");
  return { ok: true };
}
