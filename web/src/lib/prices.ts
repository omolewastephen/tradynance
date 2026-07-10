import "server-only";

import { prisma } from "@/lib/prisma";

// USD price per asset symbol, from the latest Ticker rows (populated by services/market-data).
// Stablecoins are pinned to 1. Assets without a market resolve to 0 (no known price yet).
export async function getUsdPrices(): Promise<Map<string, number>> {
  const markets = await prisma.market.findMany({
    where: { ticker: { isNot: null } },
    select: { baseAsset: { select: { symbol: true } }, ticker: { select: { lastPrice: true } } },
  });

  const prices = new Map<string, number>();
  prices.set("USDT", 1);
  prices.set("USDC", 1);
  for (const m of markets) {
    if (m.ticker) prices.set(m.baseAsset.symbol, Number(m.ticker.lastPrice));
  }
  return prices;
}

/** USD value of a holding, or null if we have no price for that asset. */
export function usdValue(
  prices: Map<string, number>,
  symbol: string,
  amount: number,
): number | null {
  const p = prices.get(symbol);
  if (p === undefined) return null;
  return p * amount;
}
