import "server-only";
import { createHash, randomInt } from "node:crypto";

import { prisma } from "@/lib/prisma";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// TODO(Phase 1/3 follow-up): route through a real transactional email provider. Logged to
// console for now so the withdrawal confirmation flow is testable end to end in dev — same
// pattern as the verification/reset emails in src/lib/auth.ts.
export function sendWithdrawalOtp(email: string, code: string) {
  console.log(`[auth] withdrawal confirmation code for ${email}: ${code}`);
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
