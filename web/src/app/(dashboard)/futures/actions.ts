"use server";

import { revalidatePath } from "next/cache";

import {
  openPosition,
  closePosition,
  type OpenPositionResult,
  type SettleResult,
  type PrismaClient,
} from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

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
  if (result.ok) revalidatePath("/futures", "layout");
  return result;
}
