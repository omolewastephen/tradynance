import { prisma } from "@/lib/prisma";
import { CoinIcon } from "@/components/brand/coin-icon";
import { cn } from "@/lib/utils";

export type RailRow = { symbol: string; price: number; changePct: number };

function fmtPrice(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  });
}

/**
 * Real prices for the auth pages, sourced from the same Ticker cache the markets page uses. Fetched
 * once in the auth layout (server component) and passed down, so the desktop panel and the mobile
 * strip share a single query. Fails soft to an empty list — the auth pages must render even if the
 * market-data service is down.
 */
export async function getAuthMarkets(limit = 5): Promise<RailRow[]> {
  const markets = await prisma.market
    .findMany({
      where: { isActive: true, ticker: { isNot: null } },
      include: { baseAsset: { select: { symbol: true } }, ticker: true },
    })
    .catch(() => []);

  return markets
    .filter((m) => m.ticker)
    .sort((a, b) => Number(b.ticker!.quoteVolume) - Number(a.ticker!.quoteVolume))
    .slice(0, limit)
    .map((m) => ({
      symbol: m.baseAsset.symbol,
      price: Number(m.ticker!.lastPrice),
      changePct: Number(m.ticker!.priceChangePercent),
    }));
}

/** Desktop: a vertical list of live markets in the brand panel. */
export function MarketRailList({ rows, className }: { rows: RailRow[]; className?: string }) {
  if (rows.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {rows.map((r) => {
        const up = r.changePct >= 0;
        return (
          <div
            key={r.symbol}
            className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface/40 px-3.5 py-2.5 backdrop-blur-sm transition-colors hover:bg-surface/70"
          >
            <div className="flex items-center gap-2.5">
              <CoinIcon symbol={r.symbol} size={26} />
              <span className="text-sm font-medium text-foreground">
                {r.symbol}
                <span className="text-foreground-subtle">/USDT</span>
              </span>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm tabular-nums text-foreground">${fmtPrice(r.price)}</div>
              <div
                className={cn(
                  "font-mono text-xs tabular-nums",
                  up ? "text-primary" : "text-danger",
                )}
              >
                {up ? "▲" : "▼"} {Math.abs(r.changePct).toFixed(2)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Mobile: a horizontally-scrolling strip of the same markets, shown under the form. */
export function MarketRailStrip({ rows, className }: { rows: RailRow[]; className?: string }) {
  if (rows.length === 0) return null;
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]", className)}>
      {rows.map((r) => {
        const up = r.changePct >= 0;
        return (
          <div
            key={r.symbol}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border-subtle bg-surface/60 px-3 py-2"
          >
            <CoinIcon symbol={r.symbol} size={20} />
            <span className="text-xs font-medium text-foreground">{r.symbol}</span>
            <span className="font-mono text-xs tabular-nums text-foreground-muted">
              ${fmtPrice(r.price)}
            </span>
            <span className={cn("font-mono text-xs tabular-nums", up ? "text-primary" : "text-danger")}>
              {up ? "+" : "−"}
              {Math.abs(r.changePct).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
