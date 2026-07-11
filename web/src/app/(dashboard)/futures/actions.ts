"use server";

import { revalidatePath } from "next/cache";

import {
  openPosition,
  closePosition,
  settleReferralCommissionsForUser,
  type OpenPositionResult,
  type SettleResult,
  type PrismaClient,
} from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

/** Best-effort: turn futures taker fees into a referrer rebate (idempotent, non-critical). */
async function settleReferral(userId: string) {
  try {
    await settleReferralCommissionsForUser(prisma as PrismaClient, userId);
  } catch {
    /* never fail a trade over commission settlement */
  }
}

export type OpenPositionInput = {
  marketSymbol: string;
  side: "LONG" | "SHORT";
  leverage: number;
  margin: string;
};

export async function openFuturesPosition(input: OpenPositionInput): Promise<OpenPositionResult> {
  const session = await requireUser();
  const result = await openPosition(prisma as PrismaClient, {
    userId: session.user.id,
    marketSymbol: input.marketSymbol,
    side: input.side,
    leverage: input.leverage,
    margin: input.margin,
  });
  if (result.ok) {
    await settleReferral(session.user.id);
    revalidatePath(`/futures/${input.marketSymbol}`);
    revalidatePath("/wallet");
  }
  return result;
}

export async function closeFuturesPosition(positionId: string): Promise<SettleResult> {
  const session = await requireUser();
  const result = await closePosition(prisma as PrismaClient, {
    userId: session.user.id,
    positionId,
  });
  if (result.ok) {
    await settleReferral(session.user.id);
    revalidatePath("/futures", "layout");
  }
  return result;
}
