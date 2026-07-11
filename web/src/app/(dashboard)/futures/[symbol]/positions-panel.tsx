"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { closeFuturesPosition } from "../actions";

export type PositionRow = {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  side: "LONG" | "SHORT";
  leverage: number;
  size: number;
  entryPrice: number;
  margin: number;
  liquidationPrice: number;
  fundingAccrued: number;
};

export type ClosedRow = {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  leverage: number;
  size: number;
  entryPrice: number;
  closePrice: number | null;
  realizedPnl: number;
  status: "CLOSED" | "LIQUIDATED";
  closedAt: string;
};

function fmt(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function signed(n: number, dp = 2) {
  return `${n >= 0 ? "+" : ""}${fmt(n, dp)}`;
}

export function PositionsPanel({
  open,
  history,
}: {
  open: PositionRow[];
  history: ClosedRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"open" | "history">("open");
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [closing, startClose] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Poll live mark prices so PnL updates without a full page reload.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/markets");
        if (!res.ok) return;
        const { markets } = (await res.json()) as { markets: { symbol: string; lastPrice: number }[] };
        if (!alive) return;
        setMarks(Object.fromEntries(markets.map((m) => [m.symbol, m.lastPrice])));
      } catch {
        /* transient — keep last marks */
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  function onClose(id: string) {
    setBusyId(id);
    startClose(async () => {
      await closeFuturesPosition(id);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-sm border border-border bg-surface">
      <div className="flex gap-4 border-b border-border px-4 py-2.5 text-sm">
        <button
          onClick={() => setTab("open")}
          className={cn(tab === "open" ? "font-medium text-foreground" : "text-foreground-muted")}
        >
          Positions{open.length ? ` (${open.length})` : ""}
        </button>
        <button
          onClick={() => setTab("history")}
          className={cn(tab === "history" ? "font-medium text-foreground" : "text-foreground-muted")}
        >
          History
        </button>
      </div>

      {tab === "open" ? (
        open.length === 0 ? (
          <Empty>No open positions.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>Pair</th>
                  <th>Side</th>
                  <th className="text-right">Size</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">Mark</th>
                  <th className="text-right">Liq. price</th>
                  <th className="text-right">Margin</th>
                  <th className="text-right">Unrealized PnL</th>
                  <th className="text-right">Close</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
                {open.map((p) => {
                  const mark = marks[p.symbol] ?? p.entryPrice;
                  const uPnl =
                    (p.side === "LONG" ? mark - p.entryPrice : p.entryPrice - mark) * p.size -
                    p.fundingAccrued;
                  const roe = p.margin > 0 ? (uPnl / p.margin) * 100 : 0;
                  const gain = uPnl >= 0;
                  return (
                    <tr key={p.id} className="[&>td]:px-4 [&>td]:py-2.5">
                      <td className="font-medium">{p.symbol}</td>
                      <td>
                        <span
                          className={cn(
                            "rounded-xs px-1.5 py-0.5 text-xs font-medium",
                            p.side === "LONG"
                              ? "bg-primary/10 text-price-up"
                              : "bg-danger/10 text-price-down",
                          )}
                        >
                          {p.side} {p.leverage}×
                        </span>
                      </td>
                      <td className="text-right font-mono tabular-nums">{fmt(p.size, 6)}</td>
                      <td className="text-right font-mono tabular-nums">{fmt(p.entryPrice)}</td>
                      <td className="text-right font-mono tabular-nums">{fmt(mark)}</td>
                      <td className="text-right font-mono tabular-nums text-warning">
                        {fmt(p.liquidationPrice)}
                      </td>
                      <td className="text-right font-mono tabular-nums">{fmt(p.margin)}</td>
                      <td
                        className={cn(
                          "text-right font-mono tabular-nums",
                          gain ? "text-price-up" : "text-price-down",
                        )}
                      >
                        {signed(uPnl)} {p.quote}
                        <span className="ml-1 text-xs opacity-70">({signed(roe)}%)</span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => onClose(p.id)}
                          disabled={closing && busyId === p.id}
                          className="rounded-xs border border-border px-2.5 py-1 text-xs text-foreground-muted transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-50"
                        >
                          {closing && busyId === p.id ? "…" : "Close"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : history.length === 0 ? (
        <Empty>No closed positions yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Pair</th>
                <th>Side</th>
                <th className="text-right">Size</th>
                <th className="text-right">Entry</th>
                <th className="text-right">Exit</th>
                <th className="text-right">Realized PnL</th>
                <th className="text-right">Status</th>
                <th className="text-right">Closed</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
              {history.map((h) => {
                const gain = h.realizedPnl >= 0;
                return (
                  <tr key={h.id} className="[&>td]:px-4 [&>td]:py-2.5">
                    <td className="font-medium">{h.symbol}</td>
                    <td className="text-foreground-muted">
                      {h.side} {h.leverage}×
                    </td>
                    <td className="text-right font-mono tabular-nums">{fmt(h.size, 6)}</td>
                    <td className="text-right font-mono tabular-nums">{fmt(h.entryPrice)}</td>
                    <td className="text-right font-mono tabular-nums">
                      {h.closePrice != null ? fmt(h.closePrice) : "—"}
                    </td>
                    <td
                      className={cn(
                        "text-right font-mono tabular-nums",
                        gain ? "text-price-up" : "text-price-down",
                      )}
                    >
                      {signed(h.realizedPnl)}
                    </td>
                    <td className="text-right">
                      <span
                        className={cn(
                          "text-xs",
                          h.status === "LIQUIDATED" ? "text-danger" : "text-foreground-muted",
                        )}
                      >
                        {h.status === "LIQUIDATED" ? "Liquidated" : "Closed"}
                      </span>
                    </td>
                    <td className="text-right text-xs text-foreground-muted">
                      {new Date(h.closedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-foreground-muted">{children}</div>;
}
