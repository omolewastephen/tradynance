import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

// Aggregated order-book snapshot: resting order quantity summed per price level.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const market = await prisma.market.findUnique({
    where: { symbol: symbol.toUpperCase() },
    select: { id: true },
  });
  if (!market) return NextResponse.json({ error: "unknown market" }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { marketId: market.id, status: { in: ["OPEN", "PARTIALLY_FILLED"] } },
    select: { side: true, price: true, quantity: true, filledQuantity: true },
  });

  // Sum remaining base qty per price level.
  const bidLevels = new Map<string, number>();
  const askLevels = new Map<string, number>();
  for (const o of orders) {
    if (!o.price) continue;
    const remaining = Number(o.quantity) - Number(o.filledQuantity);
    if (remaining <= 0) continue;
    const key = Number(o.price).toString();
    const map = o.side === "BUY" ? bidLevels : askLevels;
    map.set(key, (map.get(key) ?? 0) + remaining);
  }

  const toRows = (m: Map<string, number>, dir: "desc" | "asc") =>
    [...m.entries()]
      .map(([price, qty]) => ({ price: Number(price), qty }))
      .sort((a, b) => (dir === "desc" ? b.price - a.price : a.price - b.price))
      .slice(0, 12);

  const bids = toRows(bidLevels, "desc"); // highest bid first
  const asks = toRows(askLevels, "asc"); // lowest ask first

  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : null;

  return NextResponse.json({ bids, asks, bestBid, bestAsk, spread });
}
