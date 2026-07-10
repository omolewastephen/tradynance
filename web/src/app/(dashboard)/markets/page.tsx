import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { MarketsTable, type MarketRow } from "./markets-table";

export const metadata: Metadata = { title: "Markets — Tradynance" };

export default async function MarketsPage() {
  const session = await requireUser();

  const [markets, watchlist] = await Promise.all([
    prisma.market.findMany({
      where: { isActive: true },
      include: { baseAsset: { select: { symbol: true, name: true } }, ticker: true },
    }),
    prisma.watchlist.findMany({
      where: { userId: session.user.id },
      include: { market: { select: { symbol: true } } },
    }),
  ]);

  const rows: MarketRow[] = markets
    .filter((m) => m.ticker)
    .map((m) => ({
      symbol: m.symbol,
      base: m.baseAsset.symbol,
      name: m.baseAsset.name,
      lastPrice: Number(m.ticker!.lastPrice),
      priceChangePercent: Number(m.ticker!.priceChangePercent),
      high24h: Number(m.ticker!.high24h),
      low24h: Number(m.ticker!.low24h),
      quoteVolume: Number(m.ticker!.quoteVolume),
    }));

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Markets</h1>
        <p className="text-foreground-muted">
          Live prices update every 10s.
          {rows.length === 0 && " Waiting for the market-data service to populate tickers…"}
        </p>
      </div>
      <MarketsTable
        initialMarkets={rows}
        initialWatched={watchlist.map((w) => w.market.symbol)}
      />
    </div>
  );
}
