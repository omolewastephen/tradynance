"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

// APR is stored in basis points (800 = 8%); admins enter a percentage, which reads far better.
const productSchema = z.object({
  assetSymbol: z.string().trim().toUpperCase().min(1, "Pick an asset"),
  name: z.string().trim().min(2, "Give the product a name").max(80),
  aprPercent: z
    .string()
    .trim()
    .refine((v) => Number(v) >= 0 && Number(v) <= 1000, "APR must be between 0 and 1000%"),
  lockDays: z
    .string()
    .trim()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, "Lock days must be 0 or more"),
  minStake: z.string().trim().refine((v) => Number(v) > 0, "Minimum stake must be positive"),
  isActive: z.string().optional(),
});

function parse(formData: FormData) {
  return productSchema.safeParse({
    assetSymbol: formData.get("assetSymbol"),
    name: formData.get("name"),
    aprPercent: formData.get("aprPercent"),
    lockDays: formData.get("lockDays"),
    minStake: formData.get("minStake"),
    isActive: formData.get("isActive") ?? undefined,
  });
}

export async function createStakingProduct(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;

  const asset = await prisma.asset.findUnique({ where: { symbol: input.assetSymbol } });
  if (!asset) return { ok: false, error: `Unknown asset ${input.assetSymbol}` };

  const product = await prisma.stakingProduct.create({
    data: {
      assetId: asset.id,
      name: input.name,
      aprBps: Math.round(Number(input.aprPercent) * 100),
      lockDays: Number(input.lockDays),
      minStake: input.minStake,
      isActive: input.isActive === "on",
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "staking.product_create",
    entityType: "StakingProduct",
    entityId: product.id,
    metadata: { asset: input.assetSymbol, name: input.name, apr: input.aprPercent, lockDays: input.lockDays },
  });

  revalidatePath("/admin/staking");
  revalidatePath("/staking");
  return { ok: true };
}

export async function updateStakingProduct(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  const id = String(formData.get("id") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;

  const asset = await prisma.asset.findUnique({ where: { symbol: input.assetSymbol } });
  if (!asset) return { ok: false, error: `Unknown asset ${input.assetSymbol}` };

  const product = await prisma.stakingProduct.update({
    where: { id },
    data: {
      assetId: asset.id,
      name: input.name,
      aprBps: Math.round(Number(input.aprPercent) * 100),
      lockDays: Number(input.lockDays),
      minStake: input.minStake,
      isActive: input.isActive === "on",
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "staking.product_update",
    entityType: "StakingProduct",
    entityId: product.id,
    metadata: { asset: input.assetSymbol, name: input.name, apr: input.aprPercent },
  });

  revalidatePath("/admin/staking");
  revalidatePath("/staking");
  return { ok: true };
}

/**
 * Products with existing stake positions are never deleted — that would orphan real user money.
 * They're deactivated instead (hidden from /staking, existing positions still redeemable).
 */
export async function deleteStakingProduct(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  const id = String(formData.get("id") ?? "");

  const positions = await prisma.stakePosition.count({ where: { productId: id } });
  if (positions > 0) {
    await prisma.stakingProduct.update({ where: { id }, data: { isActive: false } });
    await recordAudit({
      actorId: session.user.id,
      action: "staking.product_deactivate",
      entityType: "StakingProduct",
      entityId: id,
      metadata: { reason: "has positions", positions },
    });
    revalidatePath("/admin/staking");
    revalidatePath("/staking");
    return { ok: false, error: `Product has ${positions} position(s) — deactivated instead of deleted.` };
  }

  await prisma.stakingProduct.delete({ where: { id } });
  await recordAudit({
    actorId: session.user.id,
    action: "staking.product_delete",
    entityType: "StakingProduct",
    entityId: id,
  });

  revalidatePath("/admin/staking");
  revalidatePath("/staking");
  return { ok: true };
}
