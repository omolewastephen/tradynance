"use server";

import { revalidatePath } from "next/cache";

import { stake, redeemStake, type StakeResult, type RedeemResult, type PrismaClient } from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function stakeAsset(productId: string, amount: string): Promise<StakeResult> {
  const session = await requireUser();
  const result = await stake(prisma as PrismaClient, { userId: session.user.id, productId, amount });
  if (result.ok) {
    revalidatePath("/staking");
    revalidatePath("/wallet");
  }
  return result;
}

export async function redeemStakePosition(positionId: string): Promise<RedeemResult> {
  const session = await requireUser();
  const result = await redeemStake(prisma as PrismaClient, { userId: session.user.id, positionId });
  if (result.ok) {
    revalidatePath("/staking");
    revalidatePath("/wallet");
  }
  return result;
}
