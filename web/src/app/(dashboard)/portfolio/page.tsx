import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { getPortfolio, getRecentActivity } from "@/lib/portfolio";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";
import { Donut } from "@/components/charts/donut";
import { PerformanceChart } from "./performance-chart";

export const metadata: Metadata = { title: "Portfolio — Tradynance" };

const usd = (n: number, max = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max });

export default async function PortfolioPage() {
  const session = await requireUser();
  const [pf, activity] = await Promise.all([
    getPortfolio(session.user.id),
    getRecentActivity(session.user.id),
  ]);
  const up = pf.change24hPct >= 0;

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Portfolio</h1>
        <p className="text-foreground-muted">Your holdings, valued at live market prices.</p>
      </div>

      {/* value header */}
      <Card className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <span className="text-micro uppercase tracking-wide text-foreground-muted">
          Total value
        </span>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-3xl font-semibold tabular-nums">${usd(pf.totalValue)}</span>
          <span
            className={"font-mono text-sm tabular-nums " + (up ? "text-price-up" : "text-price-down")}
          >
            {up ? "▲ +" : "▼ "}${usd(Math.abs(pf.change24hUsd))} ({up ? "+" : ""}
            {pf.change24hPct.toFixed(2)}%) 24h
          </span>
        </div>
      </Card>

      {/* performance + allocation */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <PerformanceChart />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-display text-h4">Allocation</h2>
          <Donut segments={pf.holdings.map((h) => ({ label: h.symbol, value: h.value }))} />
        </Card>
      </div>

      {/* holdings */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border-subtle px-5 py-3">
          <h2 className="font-display text-h4">Holdings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
                <th className="py-3 pl-5 font-medium">Asset</th>
                <th className="py-3 pr-4 text-right font-medium">Amount</th>
                <th className="py-3 pr-4 text-right font-medium">Price</th>
                <th className="py-3 pr-4 text-right font-medium">24h</th>
                <th className="py-3 pr-4 text-right font-medium">Value</th>
                <th className="py-3 pr-5 text-right font-medium">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {pf.holdings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">
                    No holdings yet — fund your account to get started.
                  </td>
                </tr>
              )}
              {pf.holdings.map((h) => {
                const hup = (h.change24h ?? 0) >= 0;
                return (
                  <tr key={h.symbol} className="border-b border-border-subtle last:border-0">
                    <td className="py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <CoinIcon symbol={h.symbol} size={28} />
                        <div className="flex flex-col">
                          <span className="font-medium">{h.symbol}</span>
                          <span className="text-xs text-foreground-muted">{h.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {h.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-foreground-muted">
                      {h.price !== null ? `$${usd(h.price, h.price < 1 ? 6 : 2)}` : "—"}
                    </td>
                    <td
                      className={
                        "py-3 pr-4 text-right font-mono tabular-nums " +
                        (h.change24h === null ? "text-foreground-muted" : hup ? "text-price-up" : "text-price-down")
                      }
                    >
                      {h.change24h !== null ? `${hup ? "+" : ""}${h.change24h.toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      ${usd(h.value)}
                    </td>
                    <td className="py-3 pr-5 text-right font-mono tabular-nums text-foreground-muted">
                      {h.allocation.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* recent activity */}
      <Card className="p-5">
        <h2 className="mb-3 font-display text-h4">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-foreground-muted">No activity yet.</p>
        ) : (
          <div className="flex flex-col">
            {activity.map((a, i) => {
              const positive = a.amount.startsWith("-") ? false : true;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border-subtle py-2.5 text-sm last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{a.kind}</span>
                    <span className="text-xs text-foreground-muted">{a.detail}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        "font-mono text-sm tabular-nums " +
                        (positive ? "text-price-up" : "text-price-down")
                      }
                    >
                      {positive ? "+" : ""}
                      {Number(a.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                      {a.symbol}
                    </span>
                    <div className="text-xs text-foreground-muted">
                      {a.at.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
