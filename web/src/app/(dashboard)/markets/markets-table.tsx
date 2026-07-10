"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Star, Search, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CoinIcon } from "@/components/brand/coin-icon";
import { toggleWatchlist } from "./watchlist-actions";

export type MarketRow = {
  symbol: string;
  base: string;
  name: string;
  lastPrice: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  quoteVolume: number;
};

type Tab = "all" | "gainers" | "losers" | "watchlist";
type SortKey = "quoteVolume" | "lastPrice" | "priceChangePercent";

function fmtPrice(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  });
}
function fmtVol(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function MarketsTable({
  initialMarkets,
  initialWatched,
}: {
  initialMarkets: MarketRow[];
  initialWatched: string[];
}) {
  const [markets, setMarkets] = useState(initialMarkets);
  const [watched, setWatched] = useState<Set<string>>(new Set(initialWatched));
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("quoteVolume");
  const [, startTransition] = useTransition();

  // Live price polling — refresh from /api/markets every 10s.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/markets");
        if (!res.ok) return;
        const { markets: fresh } = (await res.json()) as { markets: MarketRow[] };
        setMarkets(fresh);
      } catch {
        /* transient — keep last data */
      }
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    let r = markets;
    if (tab === "gainers") r = r.filter((m) => m.priceChangePercent > 0);
    if (tab === "losers") r = r.filter((m) => m.priceChangePercent < 0);
    if (tab === "watchlist") r = r.filter((m) => watched.has(m.symbol));
    if (query) {
      const q = query.toUpperCase();
      r = r.filter((m) => m.base.includes(q) || m.name.toUpperCase().includes(q));
    }
    const sorted = [...r].sort((a, b) => {
      if (tab === "gainers") return b.priceChangePercent - a.priceChangePercent;
      if (tab === "losers") return a.priceChangePercent - b.priceChangePercent;
      return b[sortKey] - a[sortKey];
    });
    return sorted;
  }, [markets, tab, query, sortKey, watched]);

  function onToggleWatch(symbol: string) {
    // optimistic
    setWatched((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
    startTransition(() => {
      void toggleWatchlist(symbol);
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "gainers", label: "Top gainers" },
    { key: "losers", label: "Top losers" },
    { key: "watchlist", label: "Watchlist" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-sm border border-border-subtle bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-xs px-3 py-1.5 text-sm transition-colors",
                tab === t.key
                  ? "bg-surface-raised font-medium text-foreground"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-48 pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface text-left text-micro uppercase tracking-wide text-foreground-muted">
              <th className="w-10 py-3 pl-4"></th>
              <th className="py-3 pr-4 font-medium">Market</th>
              <SortHeader
                label="Price"
                active={sortKey === "lastPrice"}
                onClick={() => setSortKey("lastPrice")}
              />
              <SortHeader
                label="24h %"
                active={sortKey === "priceChangePercent"}
                onClick={() => setSortKey("priceChangePercent")}
              />
              <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell">24h high</th>
              <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell">24h low</th>
              <SortHeader
                label="24h volume"
                active={sortKey === "quoteVolume"}
                onClick={() => setSortKey("quoteVolume")}
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const up = m.priceChangePercent >= 0;
              return (
                <tr
                  key={m.symbol}
                  className="border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-raised/60"
                >
                  <td className="py-3 pl-4">
                    <button
                      onClick={() => onToggleWatch(m.symbol)}
                      aria-label={watched.has(m.symbol) ? "Unwatch" : "Watch"}
                    >
                      <Star
                        className={cn(
                          "size-4 transition-colors",
                          watched.has(m.symbol)
                            ? "fill-warning text-warning"
                            : "text-foreground-muted hover:text-foreground",
                        )}
                      />
                    </button>
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/markets/${m.symbol}`}
                      className="flex items-center gap-2.5 hover:opacity-80"
                    >
                      <CoinIcon symbol={m.base} size={26} />
                      <span className="flex flex-col">
                        <span className="font-medium">{m.base}/USDT</span>
                        <span className="text-xs text-foreground-muted">{m.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                    {fmtPrice(m.lastPrice)}
                  </td>
                  <td
                    className={cn(
                      "py-3 pr-4 text-right font-mono tabular-nums",
                      up ? "text-price-up" : "text-price-down",
                    )}
                  >
                    {up ? "+" : ""}
                    {m.priceChangePercent.toFixed(2)}%
                  </td>
                  <td className="hidden py-3 pr-4 text-right font-mono tabular-nums text-foreground-muted sm:table-cell">
                    {fmtPrice(m.high24h)}
                  </td>
                  <td className="hidden py-3 pr-4 text-right font-mono tabular-nums text-foreground-muted sm:table-cell">
                    {fmtPrice(m.low24h)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-foreground-muted">
                    {fmtVol(m.quoteVolume)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-foreground-muted">
                  {tab === "watchlist"
                    ? "No markets in your watchlist yet — tap a star to add one."
                    : "No markets match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="py-3 pr-4 text-right font-medium">
      <button
        onClick={onClick}
        className={cn(
          "ml-auto flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className="size-3" />
      </button>
    </th>
  );
}
