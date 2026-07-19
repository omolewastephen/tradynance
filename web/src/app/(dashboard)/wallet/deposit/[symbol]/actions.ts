"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@tradynance/core";
import { verifyDepositTx, isVerifiableNetwork } from "@tradynance/core/chain";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/wallet";
import { enforceRateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

const claimSchema = z.object({
  assetSymbol: z.string().trim().toUpperCase(),
  network: z.string().trim(),
  // The address the user was shown (recorded for traceability; not trusted for crediting).
  toAddress: z.string().trim().max(200).optional().or(z.literal("")),
  amount: z.string().trim().refine((v) => Number(v) > 0, "Enter the amount you sent"),
  // Optional but strongly encouraged — this is what ties a real transfer to this user.
  txHash: z.string().trim().max(200).optional().or(z.literal("")),
  fromAddress: z.string().trim().max(200).optional().or(z.literal("")),
});

export type ClaimResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * User-submitted "I've made this deposit" claim. Creates a PENDING / source=CLAIM Deposit row
 * that lands in the admin review queue (Admin → Deposits). No money moves here — an admin
 * approves the claim, which runs the same idempotent creditDeposit path everything else uses.
 * This is what lets an admin trace a real transfer (txid + sender) to a specific user + amount.
 */
export async function claimDeposit(formData: FormData): Promise<ClaimResult> {
  const session = await requireUser();

  // Throttle claim spam (a burst of bogus claims is the abuse surface for the review queue).
  const limited = await enforceRateLimit("deposit:claim", session.user.id, 8, 10 * 60_000);
  if (!limited.ok) return { ok: false, error: limited.error };

  const parsed = claimSchema.safeParse({
    assetSymbol: formData.get("assetSymbol"),
    network: formData.get("network"),
    toAddress: formData.get("toAddress") || undefined,
    amount: formData.get("amount"),
    txHash: formData.get("txHash") || undefined,
    fromAddress: formData.get("fromAddress") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;

  const asset = await prisma.asset.findUnique({
    where: { symbol: input.assetSymbol },
    include: { networks: { where: { network: input.network } } },
  });
  const network = asset?.networks[0];
  if (!asset || !network) return { ok: false, error: "Unknown asset or network" };
  if (!network.isActive) return { ok: false, error: "Deposits for this network are disabled" };

  // Ensure the destination wallet exists so approval can credit it (no address derivation needed).
  await getOrCreateWallet(session.user.id, asset.id, input.network);

  // Real txid if given (unique per (network, txHash, output) — one transfer = one deposit),
  // else a synthetic key so multiple no-txid claims don't collide.
  const txHash = input.txHash || `claim:${randomUUID()}`;

  try {
    const deposit = await prisma.deposit.create({
      data: {
        userId: session.user.id,
        assetId: asset.id,
        network: input.network,
        amount: input.amount,
        txHash,
        txOutputIndex: 0,
        fromAddress: input.fromAddress || null,
        toAddress: input.toAddress || "CLAIM",
        status: "PENDING",
        source: "CLAIM",
      },
    });

    // Best-effort on-chain auto-verify — ONLY for the integrated testnets. For every other
    // coin/network this is skipped entirely, so the manual/centralized flow is unchanged: the
    // claim stays PENDING for an admin to confirm exactly as before. Never fatal.
    let autoVerified = false;
    if (input.txHash && isVerifiableNetwork(input.network) && input.toAddress) {
      const v = await verifyDepositTx({
        network: input.network,
        txHash: input.txHash,
        toAddress: input.toAddress,
        expectedAmount: input.amount,
      });
      if (v.status === "verified") {
        // Chain confirms this payment. Mark CONFIRMED (ready to credit) — still needs an admin
        // approve; crediting stays a deliberate action through creditDeposit.
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: "CONFIRMED", confirmations: v.confirmations },
        });
        autoVerified = true;
      }
    }

    await recordAudit({
      actorId: session.user.id,
      action: "deposit.claim",
      entityType: "Deposit",
      entityId: deposit.id,
      metadata: {
        asset: input.assetSymbol,
        network: input.network,
        amount: input.amount,
        txHash: input.txHash || null,
        fromAddress: input.fromAddress || null,
        autoVerified,
      },
    });

    revalidatePath(`/wallet/deposit/${input.assetSymbol}`);
    return {
      ok: true,
      message: autoVerified
        ? "Deposit verified on-chain and submitted — an admin will credit it shortly."
        : "Deposit submitted for review. You'll be credited once an admin confirms receipt.",
    };
  } catch (e) {
    // Duplicate txid — either this user already claimed it, or it's already on record.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "A deposit with this transaction ID is already on record. Contact support if it's not showing.",
      };
    }
    throw e;
  }
}
