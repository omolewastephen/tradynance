import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftRight, Gauge } from "lucide-react";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";
import { PriceChart } from "./price-chart";
import { WatchStar } from "./watch-star";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} — Tradynance` };
}

function fmt(n: number, max = 2) {
  // Clamp so maximumFractionDigits is never below minimumFractionDigits (which throws).
  const maxDigits = Math.max(2, n < 1 ? 6 : max);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  });
}

// Whole-dollar formatter for large volumes (no fractional-digit conflict).
function fmtUsd0(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-micro uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className={"mt-0.5 font-mono text-sm tabular-nums " + (className ?? "")}>
        {value}
      </span>
    </div>
  );
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const session = await requireUser();
  const { symbol } = await params;

  const market = await prisma.market.findUnique({
    where: { symbol: symbol.toUpperCase() },
    include: { baseAsset: true, ticker: true },
  });
  if (!market) notFound();

  const watched = await prisma.watchlist.findUnique({
    where: { userId_marketId: { userId: session.user.id, marketId: market.id } },
  });

  const t = market.ticker;
  const change = t ? Number(t.priceChangePercent) : 0;
  const up = change >= 0;

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/markets" className="text-sm text-accent hover:underline">
            ←
          </Link>
          <CoinIcon symbol={market.baseAsset.symbol} size={40} />
          <div>
            <h1 className="font-display text-h2 leading-none tracking-tight">
              {market.baseAsset.symbol}/USDT
            </h1>
            <span className="text-sm text-foreground-muted">{market.baseAsset.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WatchStar symbol={market.symbol} initialWatched={!!watched} />
          <Link
            href={`/futures/${market.symbol}`}
            className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-1.5 text-sm font-medium text-foreground-muted transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Gauge className="size-4" />
            Futures
          </Link>
          <Link
            href={`/trade/${market.symbol}`}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeftRight className="size-4" />
            Trade
          </Link>
        </div>
      </div>

      {t ? (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {fmt(Number(t.lastPrice))}
          </span>
          <span
            className={
              "font-mono text-lg tabular-nums " + (up ? "text-price-up" : "text-price-down")
            }
          >
            {up ? "▲ +" : "▼ "}
            {change.toFixed(2)}%
          </span>
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">
          Waiting for the market-data service to populate this ticker…
        </p>
      )}

      <Card className="p-4">
        <PriceChart symbol={market.symbol} />
      </Card>

      {t && (
        <Card className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <Stat label="24h high" value={fmt(Number(t.high24h))} />
          <Stat label="24h low" value={fmt(Number(t.low24h))} />
          <Stat label="24h volume (USDT)" value={`$${fmtUsd0(Number(t.quoteVolume))}`} />
          <Stat
            label="24h change"
            value={`${up ? "+" : ""}${change.toFixed(2)}%`}
            className={up ? "text-price-up" : "text-price-down"}
          />
        </Card>
      )}
    </div>
  );
}
