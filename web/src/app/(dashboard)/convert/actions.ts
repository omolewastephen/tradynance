"use server";

import { revalidatePath } from "next/cache";

import { convert, CONVERT_SPREAD_BPS, type ConvertResult, type PrismaClient } from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export type QuoteResult =
  | { ok: true; toAmount: number; rate: number; spreadBps: number }
  | { ok: false; error: string };

// Server-priced quote for display. Execution re-prices, so this is an estimate.
export async function getQuote(
  fromSymbol: string,
  toSymbol: string,
  fromAmount: number,
): Promise<QuoteResult> {
  await requireUser();
  if (fromSymbol === toSymbol) return { ok: false, error: "Choose two different assets" };
  if (!(fromAmount > 0)) return { ok: false, error: "Enter an amount" };

  const prices = new Map<string, number>([["USDT", 1], ["USDC", 1]]);
  const markets = await prisma.market.findMany({
    where: { ticker: { isNot: null } },
    select: { baseAsset: { select: { symbol: true } }, ticker: { select: { lastPrice: true } } },
  });
  for (const m of markets) if (m.ticker) prices.set(m.baseAsset.symbol, Number(m.ticker.lastPrice));

  const pf = prices.get(fromSymbol);
  const pt = prices.get(toSymbol);
  if (pf === undefined || pt === undefined) {
    return { ok: false, error: "No live price for one of these assets" };
  }
  const rate = (pf / pt) * (1 - CONVERT_SPREAD_BPS / 10_000);
  return { ok: true, toAmount: fromAmount * rate, rate, spreadBps: CONVERT_SPREAD_BPS };
}

export async function executeConvert(
  fromSymbol: string,
  toSymbol: string,
  fromAmount: string,
): Promise<ConvertResult> {
  const session = await requireUser();
  const result = await convert(prisma as PrismaClient, {
    userId: session.user.id,
    fromSymbol,
    toSymbol,
    fromAmount,
  });
  if (result.ok) {
    revalidatePath("/convert");
    revalidatePath("/wallet");
    revalidatePath("/portfolio");
  }
  return result;
}
