import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

const API = process.env.MARKET_DATA_API_URL ?? "https://data-api.binance.vision";
const ALLOWED_INTERVALS = new Set(["1m", "15m", "1h", "4h", "1d", "1w"]);

// Proxy candlestick (kline) data from the upstream source for the chart. Server-side so the
// source URL stays server-side and we validate the symbol against our own markets.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const interval = req.nextUrl.searchParams.get("interval") ?? "1h";
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ error: "invalid interval" }, { status: 400 });
  }

  const market = await prisma.market.findUnique({
    where: { symbol: symbol.toUpperCase() },
    select: { dataSourceSymbol: true },
  });
  if (!market?.dataSourceSymbol) {
    return NextResponse.json({ error: "unknown market" }, { status: 404 });
  }

  const limit = interval === "1m" || interval === "15m" ? 200 : 300;
  const url = `${API}/api/v3/klines?symbol=${market.dataSourceSymbol}&interval=${interval}&limit=${limit}`;

  try {
    const res = await fetch(url, { next: { revalidate: 15 } });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    const raw = (await res.json()) as unknown[][];
    // Binance kline: [openTime, open, high, low, close, volume, ...]. Map to lightweight-charts.
    const candles = raw.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000), // seconds
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    }));
    return NextResponse.json({ candles });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
