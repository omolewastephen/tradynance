import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  MAX_LEVERAGE,
  MAINTENANCE_MARGIN_RATE,
  DEFAULT_FUNDING_RATE,
} from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";
import { PriceChart } from "../../markets/[symbol]/price-chart";
import { PairSelect } from "../../trade/[symbol]/pair-select";
import { PositionForm } from "./position-form";
import { PositionsPanel, type PositionRow, type ClosedRow } from "./positions-panel";

const SPOT = "SPOT";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Perpetual — Tradynance` };
}

export default async function FuturesPage({
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

  const [allMarkets, quoteWallet, openPositions, closedPositions] = await Promise.all([
    prisma.market.findMany({
      where: { isActive: true },
      include: { baseAsset: { select: { symbol: true } } },
      orderBy: { symbol: "asc" },
    }),
    prisma.wallet.findFirst({
      where: { userId: session.user.id, assetId: market.quoteAssetId, network: SPOT },
    }),
    prisma.futuresPosition.findMany({
      where: { userId: session.user.id, status: "OPEN" },
      include: { market: { include: { baseAsset: true, quoteAsset: true } } },
      orderBy: { openedAt: "desc" },
    }),
    prisma.futuresPosition.findMany({
      where: { userId: session.user.id, status: { in: ["CLOSED", "LIQUIDATED"] } },
      include: { market: { select: { symbol: true } } },
      orderBy: { closedAt: "desc" },
      take: 25,
    }),
  ]);

  const availQuote = quoteWallet
    ? Number(quoteWallet.balance) - Number(quoteWallet.lockedBalance)
    : 0;
  const lastPrice = market.ticker ? Number(market.ticker.lastPrice) : 0;
  const change = market.ticker ? Number(market.ticker.priceChangePercent) : 0;
  const up = change >= 0;

  const openRows: PositionRow[] = openPositions.map((p) => ({
    id: p.id,
    symbol: p.market.symbol,
    base: p.market.baseAsset.symbol,
    quote: p.market.quoteAsset.symbol,
    side: p.side as "LONG" | "SHORT",
    leverage: p.leverage,
    size: Number(p.size),
    entryPrice: Number(p.entryPrice),
    margin: Number(p.margin),
    liquidationPrice: Number(p.liquidationPrice),
    fundingAccrued: Number(p.fundingAccrued),
  }));

  const historyRows: ClosedRow[] = closedPositions.map((p) => ({
    id: p.id,
    symbol: p.market.symbol,
    side: p.side as "LONG" | "SHORT",
    leverage: p.leverage,
    size: Number(p.size),
    entryPrice: Number(p.entryPrice),
    closePrice: p.closePrice != null ? Number(p.closePrice) : null,
    realizedPnl: Number(p.realizedPnl),
    status: p.status as "CLOSED" | "LIQUIDATED",
    closedAt: (p.closedAt ?? p.openedAt).toISOString(),
  }));

  const fundingPct = (Number(DEFAULT_FUNDING_RATE) * 100).toFixed(3);

  return (
    <div className="flex animate-fade-rise flex-col gap-3">
      {/* pair header */}
      <div className="flex flex-wrap items-center gap-4">
        <PairSelect
          symbol={market.symbol}
          basePath="/futures"
          markets={allMarkets.map((m) => ({ symbol: m.symbol, base: m.baseAsset.symbol }))}
        />
        <span className="rounded-xs border border-border-subtle px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-foreground-muted">
          Perpetual · up to {MAX_LEVERAGE}×
        </span>
        <div className="flex items-center gap-2">
          <CoinIcon symbol={market.baseAsset.symbol} size={24} />
          <span className="font-mono text-lg font-semibold tabular-nums">
            {lastPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: lastPrice < 1 ? 6 : 2,
            })}
          </span>
          <span
            className={
              "font-mono text-sm tabular-nums " + (up ? "text-price-up" : "text-price-down")
            }
          >
            {up ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </div>
        <div className="ml-auto text-xs text-foreground-muted">
          Funding <span className="font-mono tabular-nums text-foreground">{fundingPct}%</span> /
          interval
        </div>
      </div>

      {/* chart | position form */}
      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <Card className="p-3">
          <PriceChart symbol={market.symbol} />
        </Card>
        <Card className="p-0">
          <PositionForm
            symbol={market.symbol}
            base={market.baseAsset.symbol}
            quote={market.quoteAsset.symbol}
            availableQuote={availQuote}
            lastPrice={lastPrice}
            maxLeverage={MAX_LEVERAGE}
            takerBps={market.takerFeeBps}
            mmr={Number(MAINTENANCE_MARGIN_RATE)}
          />
        </Card>
      </div>

      <PositionsPanel open={openRows} history={historyRows} />
    </div>
  );
}
