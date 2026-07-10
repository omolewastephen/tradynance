import { NextResponse, type NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const API = process.env.MARKET_DATA_API_URL ?? "https://data-api.binance.vision";
const STABLES = new Set(["USDT", "USDC"]);

// range → (kline interval, number of points)
const RANGES: Record<string, { interval: string; limit: number }> = {
  "24h": { interval: "1h", limit: 24 },
  "7d": { interval: "4h", limit: 42 },
  "30d": { interval: "1d", limit: 30 },
};

// Portfolio value over time = Σ (current holding × historical close price). Uses real klines.
// NB: assumes current holdings held constant over the window (a "what my portfolio would have
// been worth" view), not a mark-to-market reconstruction of past holdings — labeled as such
// in the UI.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const range = req.nextUrl.searchParams.get("range") ?? "7d";
  const cfg = RANGES[range] ?? RANGES["7d"];

  // Current holdings per asset symbol.
  const wallets = await prisma.wallet.findMany({
    where: { userId: session.user.id },
    include: { asset: { select: { symbol: true } } },
  });
  const amount = new Map<string, number>();
  for (const w of wallets) {
    amount.set(w.asset.symbol, (amount.get(w.asset.symbol) ?? 0) + Number(w.balance));
  }
  const held = [...amount.entries()].filter(([, a]) => a > 0);
  if (held.length === 0) return NextResponse.json({ series: [] });

  const nonStable = held.filter(([s]) => !STABLES.has(s));
  const stableValue = held
    .filter(([s]) => STABLES.has(s))
    .reduce((sum, [, a]) => sum + a, 0);

  // Fetch klines for each non-stable held asset with a market.
  const marketBySymbol = new Map(
    (
      await prisma.market.findMany({
        where: { baseAsset: { symbol: { in: nonStable.map(([s]) => s) } } },
        select: { dataSourceSymbol: true, baseAsset: { select: { symbol: true } } },
      })
    ).map((m) => [m.baseAsset.symbol, m.dataSourceSymbol]),
  );

  async function klines(symbol: string): Promise<[number, number][]> {
    const ds = marketBySymbol.get(symbol);
    if (!ds) return [];
    try {
      const res = await fetch(
        `${API}/api/v3/klines?symbol=${ds}&interval=${cfg.interval}&limit=${cfg.limit}`,
        { next: { revalidate: 60 } },
      );
      if (!res.ok) return [];
      const raw = (await res.json()) as unknown[][];
      return raw.map((k) => [Math.floor(Number(k[0]) / 1000), Number(k[4])]); // [time, close]
    } catch {
      return [];
    }
  }

  const results = await Promise.all(nonStable.map(([s]) => klines(s)));

  // time bucket → summed value
  const buckets = new Map<number, number>();
  results.forEach((candles, i) => {
    const amt = nonStable[i][1];
    for (const [t, close] of candles) {
      buckets.set(t, (buckets.get(t) ?? 0) + close * amt);
    }
  });

  // Stables add a flat contribution at every timestamp we have.
  const series = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, v]) => ({ time, value: v + stableValue }));

  // Only stables held → flat line across the reference timestamps.
  if (series.length === 0 && stableValue > 0) {
    const ref = await klines("BTC");
    return NextResponse.json({
      series: ref.map(([time]) => ({ time, value: stableValue })),
    });
  }

  return NextResponse.json({ series });
}
