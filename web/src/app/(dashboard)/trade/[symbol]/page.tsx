import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";
import { PriceChart } from "../../markets/[symbol]/price-chart";
import { OrderBook } from "./order-book";
import { OrderForm } from "./order-form";
import { OrdersPanel, type OrderRow } from "./orders-panel";
import { PairSelect } from "./pair-select";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `Trade ${symbol.toUpperCase()} — Tradynance` };
}

const SPOT = "SPOT";

export default async function TradePage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const session = await requireUser();
  const { symbol } = await params;

  const market = await prisma.market.findUnique({
    where: { symbol: symbol.toUpperCase() },
    include: { baseAsset: true, quoteAsset: true, ticker: true },
  });
  if (!market) notFound();

  const [allMarkets, baseWallet, quoteWallet, openOrders, historyOrders] = await Promise.all([
    prisma.market.findMany({
      where: { isActive: true },
      include: { baseAsset: { select: { symbol: true } } },
      orderBy: { symbol: "asc" },
    }),
    prisma.wallet.findFirst({
      where: { userId: session.user.id, assetId: market.baseAssetId, network: SPOT },
    }),
    prisma.wallet.findFirst({
      where: { userId: session.user.id, assetId: market.quoteAssetId, network: SPOT },
    }),
    prisma.order.findMany({
      where: { userId: session.user.id, status: { in: ["OPEN", "PARTIALLY_FILLED"] } },
      include: { market: { select: { symbol: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: { userId: session.user.id, status: { in: ["FILLED", "CANCELLED", "REJECTED"] } },
      include: { market: { select: { symbol: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const availBase = baseWallet
    ? Number(baseWallet.balance) - Number(baseWallet.lockedBalance)
    : 0;
  const availQuote = quoteWallet
    ? Number(quoteWallet.balance) - Number(quoteWallet.lockedBalance)
    : 0;
  const lastPrice = market.ticker ? Number(market.ticker.lastPrice) : 0;
  const change = market.ticker ? Number(market.ticker.priceChangePercent) : 0;
  const up = change >= 0;

  const toRow = (o: (typeof openOrders)[number]): OrderRow => ({
    id: o.id,
    symbol: o.market.symbol,
    side: o.side as "BUY" | "SELL",
    type: o.type,
    price: o.price ? o.price.toString() : null,
    quantity: o.quantity.toString(),
    filledQuantity: o.filledQuantity.toString(),
    avgFillPrice: o.avgFillPrice ? o.avgFillPrice.toString() : null,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  });

  return (
    <div className="flex animate-fade-rise flex-col gap-3">
      {/* pair header */}
      <div className="flex flex-wrap items-center gap-4">
        <PairSelect
          symbol={market.symbol}
          markets={allMarkets.map((m) => ({ symbol: m.symbol, base: m.baseAsset.symbol }))}
        />
        <div className="flex items-center gap-2">
          <CoinIcon symbol={market.baseAsset.symbol} size={24} />
          <span className="font-mono text-lg font-semibold tabular-nums">
            {lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: lastPrice < 1 ? 6 : 2 })}
          </span>
          <span className={"font-mono text-sm tabular-nums " + (up ? "text-price-up" : "text-price-down")}>
            {up ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 3-column: chart | order book | order form */}
      <div className="grid gap-3 lg:grid-cols-[1fr_18rem_18rem]">
        <Card className="p-3">
          <PriceChart symbol={market.symbol} />
        </Card>
        <Card className="p-0">
          <OrderBook symbol={market.symbol} />
        </Card>
        <Card className="p-0">
          <OrderForm
            symbol={market.symbol}
            base={market.baseAsset.symbol}
            quote={market.quoteAsset.symbol}
            availableBase={availBase}
            availableQuote={availQuote}
            lastPrice={lastPrice}
          />
        </Card>
      </div>

      <OrdersPanel open={openOrders.map(toRow)} history={historyOrders.map(toRow)} />
    </div>
  );
}
