"use server";

import { revalidatePath } from "next/cache";

import {
  openPosition,
  closePosition,
  settleReferralCommissionsForUser,
  effectiveTakerBpsForUser,
  type OpenPositionResult,
  type SettleResult,
  type PrismaClient,
} from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/observability";

/** Best-effort: turn futures taker fees into a referrer rebate (idempotent, non-critical). */
async function settleReferral(userId: string) {
  try {
    await settleReferralCommissionsForUser(prisma as PrismaClient, userId);
  } catch (e) {
    // Never fail a trade over commission settlement — but surface it instead of swallowing.
    captureException(e, { where: "settleReferralCommissions", userId });
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
  const takerFeeBpsOverride = await effectiveTakerBpsForUser(
    prisma as PrismaClient,
    session.user.id,
    input.marketSymbol,
  );
  const result = await openPosition(prisma as PrismaClient, {
    userId: session.user.id,
    marketSymbol: input.marketSymbol,
    side: input.side,
    leverage: input.leverage,
    margin: input.margin,
    takerFeeBpsOverride,
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
  const position = await prisma.futuresPosition.findUnique({
    where: { id: positionId },
    select: { market: { select: { symbol: true } } },
  });
  const takerFeeBpsOverride = position
    ? await effectiveTakerBpsForUser(prisma as PrismaClient, session.user.id, position.market.symbol)
    : undefined;
  const result = await closePosition(prisma as PrismaClient, {
    userId: session.user.id,
    positionId,
    takerFeeBpsOverride,
  });
  if (result.ok) {
    await settleReferral(session.user.id);
    revalidatePath("/futures", "layout");
  }
  return result;
}
