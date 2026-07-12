"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { creditDeposit, type PrismaClient } from "@tradynance/core";
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
