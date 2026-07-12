"use server";

import { revalidatePath } from "next/cache";

import { listNft, cancelListing, buyNft, type PrismaClient } from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function listNftAction(nftId: string, price: string) {
  const session = await requireUser();
  const result = await listNft(prisma as PrismaClient, { userId: session.user.id, nftId, price });
  if (result.ok) revalidatePath("/nft");
  return result;
}

export async function cancelListingAction(listingId: string) {
  const session = await requireUser();
  const result = await cancelListing(prisma as PrismaClient, { userId: session.user.id, listingId });
  if (result.ok) revalidatePath("/nft");
  return result;
}

export async function buyNftAction(listingId: string) {
  const session = await requireUser();
  const result = await buyNft(prisma as PrismaClient, { userId: session.user.id, listingId });
  if (result.ok) {
    revalidatePath("/nft");
    revalidatePath("/wallet");
  }
  return result;
}
