// Tradynance market-data — standalone poller. Fetches 24h ticker stats for every active
// market from the upstream source and upserts them into the Ticker table, which the Next.js
// app reads for the markets list, coin pages, and USD portfolio valuation.
//
// This is a polling cache, NOT a source of truth for anything money-related. A full
// WebSocket broadcaster (live ticks/order book) is the eventual design (see CLAUDE.md);
// polling every few seconds is the honest MVP and is enough for list + chart + valuation.

import { prisma } from "@tradynance/core";

const API = process.env.MARKET_DATA_API_URL ?? "https://data-api.binance.vision";
const POLL_MS = Number(process.env.MARKET_DATA_POLL_MS ?? 10_000);

interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

let running = true;

async function fetchTickers(symbols: string[]): Promise<Ticker24h[]> {
  // Binance accepts ?symbols=["BTCUSDT","ETHUSDT"] for a batched 24h ticker request.
  const param = encodeURIComponent(JSON.stringify(symbols));
  const res = await fetch(`${API}/api/v3/ticker/24hr?symbols=${param}`);
  if (!res.ok) throw new Error(`ticker fetch ${res.status} ${res.statusText}`);
  return (await res.json()) as Ticker24h[];
}

async function tick(): Promise<void> {
  const markets = await prisma.market.findMany({
    where: { isActive: true, dataSourceSymbol: { not: null } },
    select: { id: true, dataSourceSymbol: true },
  });
  if (markets.length === 0) return;

  const bySymbol = new Map(markets.map((m) => [m.dataSourceSymbol!, m.id]));
  const tickers = await fetchTickers([...bySymbol.keys()]);

  let updated = 0;
  for (const t of tickers) {
    const marketId = bySymbol.get(t.symbol);
    if (!marketId) continue;
    const data = {
      lastPrice: t.lastPrice,
      priceChangePercent: t.priceChangePercent,
      high24h: t.highPrice,
      low24h: t.lowPrice,
      volume: t.volume,
      quoteVolume: t.quoteVolume,
    };
    await prisma.ticker.upsert({
      where: { marketId },
      create: { marketId, ...data },
      update: data,
    });
    updated++;
  }
  console.log(`[market-data] updated ${updated}/${markets.length} tickers`);
}

async function main(): Promise<void> {
  console.log(`[market-data] starting — source ${API}, poll ${POLL_MS}ms`);
  process.on("SIGINT", () => { running = false; });
  process.on("SIGTERM", () => { running = false; });

  while (running) {
    const started = Date.now();
    try {
      await tick();
    } catch (err) {
      console.error("[market-data] tick failed:", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, Math.max(0, POLL_MS - (Date.now() - started))));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[market-data] fatal:", err);
  process.exit(1);
});
