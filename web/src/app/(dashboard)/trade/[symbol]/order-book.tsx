"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Level = { price: number; qty: number };
type Book = { bids: Level[]; asks: Level[]; spread: number | null };
type Trade = { price: number; qty: number; side: "BUY" | "SELL"; time: string };

function fmtP(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  });
}
function fmtQ(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

export function OrderBook({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState<"book" | "trades">("book");
  const [book, setBook] = useState<Book | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        if (tab === "book") {
          const r = await fetch(`/api/markets/${symbol}/orderbook`);
          if (r.ok && active) setBook(await r.json());
        } else {
          const r = await fetch(`/api/markets/${symbol}/trades`);
          if (r.ok && active) setTrades((await r.json()).trades);
        }
      } catch {
        /* transient */
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbol, tab]);

  const maxQty = book
    ? Math.max(1, ...book.bids.map((b) => b.qty), ...book.asks.map((a) => a.qty))
    : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-border-subtle p-1">
        {(["book", "trades"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-xs px-3 py-1.5 text-sm transition-colors",
              tab === t
                ? "bg-surface-raised font-medium text-foreground"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {t === "book" ? "Order book" : "Market trades"}
          </button>
        ))}
      </div>

      {tab === "book" ? (
        <div className="flex flex-1 flex-col p-2 font-mono text-xs tabular-nums">
          <div className="flex justify-between px-1 pb-1 text-micro uppercase tracking-wide text-foreground-muted">
            <span>Price</span>
            <span>Size</span>
          </div>
          {/* asks: lowest at bottom (reverse so best ask sits next to spread) */}
          <div className="flex flex-1 flex-col-reverse justify-end">
            {book?.asks.map((a) => (
              <Row key={`a${a.price}`} price={a.price} qty={a.qty} max={maxQty} side="ask" />
            ))}
          </div>
          <div className="my-1 border-y border-border-subtle px-1 py-1 text-center text-foreground-muted">
            {book?.spread != null ? `spread ${fmtP(book.spread)}` : "—"}
          </div>
          <div className="flex flex-1 flex-col">
            {book?.bids.map((b) => (
              <Row key={`b${b.price}`} price={b.price} qty={b.qty} max={maxQty} side="bid" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 font-mono text-xs tabular-nums">
          <div className="flex justify-between px-1 pb-1 text-micro uppercase tracking-wide text-foreground-muted">
            <span>Price</span>
            <span>Size</span>
            <span>Time</span>
          </div>
          {trades.length === 0 && (
            <p className="px-1 py-4 text-center text-foreground-muted">No trades yet.</p>
          )}
          {trades.map((t, i) => (
            <div key={i} className="flex justify-between px-1 py-0.5">
              <span className={t.side === "BUY" ? "text-price-up" : "text-price-down"}>
                {fmtP(t.price)}
              </span>
              <span>{fmtQ(t.qty)}</span>
              <span className="text-foreground-muted">
                {new Date(t.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  price,
  qty,
  max,
  side,
}: {
  price: number;
  qty: number;
  max: number;
  side: "bid" | "ask";
}) {
  const pct = Math.min(100, (qty / max) * 100);
  return (
    <div className="relative flex justify-between px-1 py-0.5">
      <div
        className={cn(
          "absolute inset-y-0 right-0",
          side === "bid" ? "bg-price-up/10" : "bg-price-down/10",
        )}
        style={{ width: `${pct}%` }}
      />
      <span className={cn("relative", side === "bid" ? "text-price-up" : "text-price-down")}>
        {fmtP(price)}
      </span>
      <span className="relative">{fmtQ(qty)}</span>
    </div>
  );
}
