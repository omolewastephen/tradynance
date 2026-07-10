"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const antiPhishingSchema = z
  .string()
  .trim()
  .min(4, "At least 4 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-zA-Z0-9]+$/, "Letters and numbers only");

export async function updateAntiPhishingCode(rawCode: string) {
  const session = await requireUser();
  const code = antiPhishingSchema.parse(rawCode);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { antiPhishingCode: code },
  });

  return { code };
}

// ── Withdrawal address whitelist ──────────────────────────────────────────

const whitelistSchema = z.object({
  label: z.string().trim().min(1, "Add a label").max(40),
  network: z.string().trim().min(1, "Network required"),
  address: z.string().trim().min(8, "Enter a valid address"),
  memo: z.string().trim().max(120).optional().or(z.literal("")),
});

export type WhitelistResult = { ok: true } | { ok: false; error: string };

export async function addWhitelistAddress(formData: FormData): Promise<WhitelistResult> {
  const session = await requireUser();
  const parsed = whitelistSchema.safeParse({
    label: formData.get("label"),
    network: formData.get("network"),
    address: formData.get("address"),
    memo: formData.get("memo") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const existing = await prisma.withdrawalWhitelist.findFirst({
    where: { userId: session.user.id, network: input.network, address: input.address },
  });
  if (existing) return { ok: false, error: "That address is already whitelisted" };

  await prisma.withdrawalWhitelist.create({
    data: {
      userId: session.user.id,
      label: input.label,
      network: input.network.toUpperCase(),
      address: input.address,
      memo: input.memo || undefined,
    },
  });
  revalidatePath("/settings/security");
  return { ok: true };
}

export async function removeWhitelistAddress(id: string): Promise<WhitelistResult> {
  const session = await requireUser();
  // Scope the delete to the owner so a user can't remove someone else's entry.
  await prisma.withdrawalWhitelist.deleteMany({
    where: { id, userId: session.user.id },
  });
  revalidatePath("/settings/security");
  return { ok: true };
}

export async function setWhitelistOnly(enabled: boolean): Promise<WhitelistResult> {
  const session = await requireUser();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { withdrawalWhitelistOnly: enabled },
  });
  revalidatePath("/settings/security");
  return { ok: true };
}
