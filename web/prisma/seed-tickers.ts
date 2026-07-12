import { Prisma } from "@tradynance/core";
import { prisma } from "../src/lib/prisma";

const D = (n: string | number) => new Prisma.Decimal(n);

// Static fallback prices so markets have a price the moment the DB is seeded — before the live
// market-data service's first poll (and so CI, which doesn't run that service, has marks for the
// futures/convert tests). CREATE-ONLY: never overwrites a live ticker; market-data owns updates.
const PRICES: Record<string, number> = {
  BTC: 64000, ETH: 3000, BNB: 550, SOL: 150, XRP: 0.5, DOGE: 0.12,
  TRX: 0.12, LTC: 80, ADA: 0.45, MATIC: 0.7, AVAX: 30, BCH: 400, LINK: 15, TON: 6,
};

export async function seedTickers() {
  const markets = await prisma.market.findMany({
    include: { baseAsset: { select: { symbol: true } }, ticker: { select: { id: true } } },
  });
  let created = 0;
  for (const m of markets) {
    if (m.ticker) continue; // don't clobber a live price
    const price = PRICES[m.baseAsset.symbol] ?? 100;
    await prisma.ticker.create({
      data: {
        marketId: m.id,
        lastPrice: D(price),
        priceChangePercent: D("1.50"),
        high24h: D(price * 1.03),
        low24h: D(price * 0.97),
        volume: D(1000),
        quoteVolume: D(price * 1000),
      },
    });
    created++;
  }
  console.log(`[seed] tickers: ${created} static (missing) of ${markets.length} markets`);
}
