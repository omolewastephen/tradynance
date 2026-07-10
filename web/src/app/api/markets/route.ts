import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Current markets + latest ticker, for client-side polling on the markets page.
export async function GET() {
  const markets = await prisma.market.findMany({
    where: { isActive: true },
    include: {
      baseAsset: { select: { symbol: true, name: true } },
      ticker: true,
    },
  });

  const data = markets
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
      updatedAt: m.ticker!.updatedAt,
    }));

  return NextResponse.json({ markets: data });
}
