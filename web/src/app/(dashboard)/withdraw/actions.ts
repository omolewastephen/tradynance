"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  reserveWithdrawalFunds,
  releaseWithdrawal,
  InsufficientFundsError,
} from "@tradynance/core";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import {
  generateOtp,
  hashOtp,
  sendWithdrawalOtp,
  getAvailable,
  OTP_TTL_MS,
} from "@/lib/withdrawal";

const requestSchema = z.object({
  assetSymbol: z.string().trim().toUpperCase(),
  network: z.string().trim(),
  destinationAddress: z.string().trim().min(8, "Enter a valid destination address"),
  destinationMemo: z.string().trim().optional().or(z.literal("")),
  amount: z.string().trim().refine((v) => Number(v) > 0, "Amount must be positive"),
});

export type RequestResult =
  | { ok: true; withdrawalId: string; requiresTwoFactor: boolean; fee: string; total: string }
  | { ok: false; error: string };

export async function requestWithdrawal(formData: FormData): Promise<RequestResult> {
  const session = await requireUser();

  // Cap withdrawal requests per user (abuse / enumeration of destinations).
  const limited = await enforceRateLimit("withdraw:request", session.user.id, 5, 60_000);
  if (!limited.ok) return { ok: false, error: limited.error };

  const parsed = requestSchema.safeParse({
    assetSymbol: formData.get("assetSymbol"),
    network: formData.get("network"),
    destinationAddress: formData.get("destinationAddress"),
    destinationMemo: formData.get("destinationMemo") || undefined,
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;

  const asset = await prisma.asset.findUnique({
    where: { symbol: input.assetSymbol },
    include: { networks: { where: { network: input.network } } },
  });
  const network = asset?.networks[0];
  if (!asset || !network) return { ok: false, error: "Unknown asset or network" };

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      withdrawalWhitelistOnly: true,
      twoFactorEnabled: true,
      email: true,
      antiPhishingCode: true,
      kycStatus: true,
    },
  });

  // KYC gate. Enforced server-side here (not just hidden in the UI) because this is the point
  // where value actually leaves the platform.
  if (user.kycStatus !== "VERIFIED") {
    const reason =
      user.kycStatus === "PENDING"
        ? "Your identity verification is still under review. Withdrawals unlock once it's approved."
        : user.kycStatus === "REJECTED"
          ? "Your identity verification wasn't approved. Please resubmit it before withdrawing."
          : "Verify your identity before withdrawing funds.";
    return { ok: false, error: reason };
  }

  // Whitelist enforcement.
  if (user.withdrawalWhitelistOnly) {
    const whitelisted = await prisma.withdrawalWhitelist.findFirst({
      where: {
        userId: session.user.id,
        network: input.network,
        address: input.destinationAddress,
      },
    });
    if (!whitelisted) {
      return {
        ok: false,
        error: "Address is not in your withdrawal whitelist (required by your settings).",
      };
    }
  }

  const amount = Number(input.amount);
  const fee = Number(network.withdrawalFee);
  const total = amount + fee;
  const available = await getAvailable(session.user.id, asset.id, input.network);
  if (available < total) {
    return {
      ok: false,
      error: `Insufficient available balance. Available ${available}, need ${total} (incl. ${fee} fee).`,
    };
  }

  const code = generateOtp();
  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId: session.user.id,
      assetId: asset.id,
      network: input.network,
      amount: input.amount,
      fee: network.withdrawalFee,
      destinationAddress: input.destinationAddress,
      destinationMemo: input.destinationMemo || undefined,
      status: "AWAITING_CONFIRMATION",
      confirmationCodeHash: hashOtp(code),
      confirmationExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  await sendWithdrawalOtp(user.email, code, user.antiPhishingCode);

  await recordAudit({
    actorId: session.user.id,
    action: "withdrawal.request",
    entityType: "Withdrawal",
    entityId: withdrawal.id,
    metadata: { asset: input.assetSymbol, network: input.network, amount: input.amount, destination: input.destinationAddress },
  });

  return {
    ok: true,
    withdrawalId: withdrawal.id,
    requiresTwoFactor: user.twoFactorEnabled ?? false,
    fee: network.withdrawalFee.toString(),
    total: total.toString(),
  };
}

const confirmSchema = z.object({
  withdrawalId: z.string(),
  otp: z.string().trim().length(6, "Enter the 6-digit email code"),
  // Second factor: TOTP code if 2FA enabled, else account password.
  totp: z.string().trim().optional().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
});

export type ConfirmResult = { ok: true } | { ok: false; error: string };

export async function confirmWithdrawal(formData: FormData): Promise<ConfirmResult> {
  const session = await requireUser();

  // Throttle confirmation attempts — this step verifies the email OTP + TOTP/password, so it's
  // the brute-force surface for a pending withdrawal.
  const limited = await enforceRateLimit("withdraw:confirm", session.user.id, 8, 5 * 60_000);
  if (!limited.ok) return { ok: false, error: limited.error };

  const parsed = confirmSchema.safeParse({
    withdrawalId: formData.get("withdrawalId"),
    otp: formData.get("otp"),
    totp: formData.get("totp") || undefined,
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: input.withdrawalId } });
  if (!withdrawal || withdrawal.userId !== session.user.id) {
    return { ok: false, error: "Withdrawal not found" };
  }
  if (withdrawal.status !== "AWAITING_CONFIRMATION") {
    return { ok: false, error: "This withdrawal is no longer awaiting confirmation" };
  }
  if (!withdrawal.confirmationExpiresAt || withdrawal.confirmationExpiresAt < new Date()) {
    return { ok: false, error: "The confirmation code has expired. Start a new withdrawal." };
  }
  if (withdrawal.confirmationCodeHash !== hashOtp(input.otp)) {
    return { ok: false, error: "Incorrect email code" };
  }

  // Second factor.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });
  const hdrs = await headers();
  if (user.twoFactorEnabled) {
    if (!input.totp) return { ok: false, error: "Enter your authenticator (2FA) code" };
    try {
      await auth.api.verifyTOTP({ body: { code: input.totp }, headers: hdrs });
    } catch {
      return { ok: false, error: "Invalid 2FA code" };
    }
  } else {
    if (!input.password) return { ok: false, error: "Enter your account password" };
    const res = await auth.api.verifyPassword({
      body: { password: input.password },
      headers: hdrs,
    });
    if (!res?.status) return { ok: false, error: "Incorrect password" };
  }

  // Passed all checks — reserve the funds (locks + flips to PENDING).
  try {
    await reserveWithdrawalFunds(prisma, withdrawal.id);
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return { ok: false, error: "Insufficient available balance at confirmation time." };
    }
    throw e;
  }
  // Consume the OTP.
  await prisma.withdrawal.update({
    where: { id: withdrawal.id },
    data: { confirmationCodeHash: null },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "withdrawal.confirm",
    entityType: "Withdrawal",
    entityId: withdrawal.id,
    metadata: { amount: withdrawal.amount.toString(), status: "PENDING" },
  });

  revalidatePath("/withdraw");
  revalidatePath("/wallet");
  return { ok: true };
}

export async function cancelWithdrawal(withdrawalId: string): Promise<ConfirmResult> {
  const session = await requireUser();
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal || withdrawal.userId !== session.user.id) {
    return { ok: false, error: "Withdrawal not found" };
  }
  if (!["AWAITING_CONFIRMATION", "PENDING"].includes(withdrawal.status)) {
    return { ok: false, error: "This withdrawal can no longer be cancelled" };
  }
  await releaseWithdrawal(prisma, {
    withdrawalId,
    status: "CANCELLED",
    actorId: session.user.id,
  });
  await recordAudit({
    actorId: session.user.id,
    action: "withdrawal.cancel",
    entityType: "Withdrawal",
    entityId: withdrawalId,
    metadata: { fromStatus: withdrawal.status },
  });
  revalidatePath("/withdraw");
  revalidatePath("/wallet");
  return { ok: true };
}
