"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function toggleWatchlist(marketSymbol: string): Promise<{ watched: boolean }> {
  const session = await requireUser();
  const market = await prisma.market.findUnique({
    where: { symbol: marketSymbol },
    select: { id: true },
  });
  if (!market) return { watched: false };

  const existing = await prisma.watchlist.findUnique({
    where: { userId_marketId: { userId: session.user.id, marketId: market.id } },
  });

  let watched: boolean;
  if (existing) {
    await prisma.watchlist.delete({ where: { id: existing.id } });
    watched = false;
  } else {
    await prisma.watchlist.create({
      data: { userId: session.user.id, marketId: market.id },
    });
    watched = true;
  }

  revalidatePath("/markets");
  return { watched };
}
