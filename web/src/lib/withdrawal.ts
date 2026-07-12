import "server-only";
import { createHash, randomInt } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sendWithdrawalOtpEmail } from "@/lib/email";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Real send via Resend when RESEND_API_KEY is set; console fallback in dev (see email.ts). The
// user's anti-phishing code is included so they can trust the message.
export async function sendWithdrawalOtp(email: string, code: string, antiPhishing?: string | null) {
  await sendWithdrawalOtpEmail(email, code, antiPhishing);
}

/** Available balance for a (user, asset, network) wallet = balance − lockedBalance. */
export async function getAvailable(
  userId: string,
  assetId: string,
  network: string,
): Promise<number> {
  const wallet = await prisma.wallet.findFirst({
    where: { userId, assetId, network },
    select: { balance: true, lockedBalance: true },
  });
  if (!wallet) return 0;
  return Number(wallet.balance) - Number(wallet.lockedBalance);
}
