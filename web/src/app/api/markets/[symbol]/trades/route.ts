import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

// Recent market trades (public tape) for a symbol.
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

  const trades = await prisma.trade.findMany({
    where: { marketId: market.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { price: true, quantity: true, takerSide: true, createdAt: true },
  });

  return NextResponse.json({
    trades: trades.map((t) => ({
      price: Number(t.price),
      qty: Number(t.quantity),
      side: t.takerSide,
      time: t.createdAt,
    })),
  });
}
