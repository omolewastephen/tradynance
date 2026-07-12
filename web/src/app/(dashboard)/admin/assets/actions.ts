"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/admin";

const schema = z.object({
  depositAddress: z.string().trim().max(200).optional().or(z.literal("")),
  depositMemo: z.string().trim().max(120).optional().or(z.literal("")),
  minDeposit: z.string().trim().refine((v) => Number(v) >= 0, "Invalid amount"),
  withdrawalFee: z.string().trim().refine((v) => Number(v) >= 0, "Invalid fee"),
  requiresMemo: z.boolean(),
  isActive: z.boolean(),
});

export type AssetNetworkResult = { ok: true } | { ok: false; error: string };

export async function updateAssetNetwork(id: string, input: {
  depositAddress: string;
  depositMemo: string;
  minDeposit: string;
  withdrawalFee: string;
  requiresMemo: boolean;
  isActive: boolean;
}): Promise<AssetNetworkResult> {
  const session = await requireRole(FINANCE_ROLES);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const net = await prisma.assetNetwork.findUnique({ where: { id }, include: { asset: { select: { symbol: true } } } });
  if (!net) return { ok: false, error: "Network not found" };

  await prisma.assetNetwork.update({
    where: { id },
    data: {
      depositAddress: d.depositAddress?.trim() || null,
      depositMemo: d.depositMemo?.trim() || null,
      minDeposit: d.minDeposit,
      withdrawalFee: d.withdrawalFee,
      requiresMemo: d.requiresMemo,
      isActive: d.isActive,
    },
  });
  await recordAudit({
    actorId: session.user.id,
    action: "asset.network_update",
    entityType: "AssetNetwork",
    entityId: id,
    metadata: { asset: net.asset.symbol, network: net.network, depositAddress: d.depositAddress || null },
  });
  revalidatePath("/admin/assets");
  return { ok: true };
}
