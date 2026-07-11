"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { openFuturesPosition } from "../actions";

type Side = "LONG" | "SHORT";

function fmt(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function PositionForm({
  symbol,
  base,
  quote,
  availableQuote,
  lastPrice,
  maxLeverage,
  takerBps,
  mmr,
}: {
  symbol: string;
  base: string;
  quote: string;
  availableQuote: number;
  lastPrice: number;
  maxLeverage: number;
  takerBps: number;
  mmr: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [side, setSide] = useState<Side>("LONG");
  const [leverage, setLeverage] = useState(10);
  const [margin, setMargin] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const marginNum = Number(margin) || 0;
  const notional = marginNum * leverage;
  const size = lastPrice > 0 ? notional / lastPrice : 0;
  const openFee = (notional * takerBps) / 10_000;
  const cost = marginNum + openFee;
  const liqPrice =
    lastPrice > 0
      ? side === "LONG"
        ? lastPrice * (1 - 1 / leverage + mmr)
        : lastPrice * (1 + 1 / leverage - mmr)
      : 0;
  const insufficient = cost > availableQuote;

  function setPct(pct: number) {
    setMargin((availableQuote * pct).toFixed(2));
  }

  function onSubmit() {
    setMsg(null);
    startTransition(async () => {
      const res = await openFuturesPosition({ marketSymbol: symbol, side, leverage, margin });
      if (res.ok) {
        setMsg({
          ok: true,
          text: `${side} opened — ${Number(res.size).toFixed(6)} ${base} @ ${fmt(Number(res.entryPrice))}`,
        });
        setMargin("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  const isLong = side === "LONG";

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Long / Short */}
      <div className="grid grid-cols-2 gap-1 rounded-sm border border-border-subtle p-1">
        {(["LONG", "SHORT"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "rounded-xs py-1.5 text-sm font-medium transition-colors",
              side === s
                ? s === "LONG"
                  ? "bg-primary text-primary-foreground"
                  : "bg-danger text-danger-foreground"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {s === "LONG" ? "Long" : "Short"}
          </button>
        ))}
      </div>

      {/* Leverage */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>Leverage</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">{leverage}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxLeverage}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="accent-primary"
          aria-label="Leverage"
        />
        <div className="flex gap-1">
          {[2, 5, 10, 20, maxLeverage].map((l) => (
            <button
              key={l}
              onClick={() => setLeverage(l)}
              className={cn(
                "flex-1 rounded-xs border py-1 text-xs transition-colors",
                leverage === l
                  ? "border-primary/50 text-foreground"
                  : "border-border text-foreground-muted hover:text-foreground",
              )}
            >
              {l}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-xs text-foreground-muted">
        <span>Available</span>
        <span className="font-mono tabular-nums">
          {fmt(availableQuote)} {quote}
        </span>
      </div>

      <label htmlFor="margin" className="flex flex-col gap-1 text-xs text-foreground-muted">
        Margin ({quote})
        <Input
          id="margin"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          inputMode="decimal"
          className="font-mono"
          placeholder="0.00"
        />
      </label>

      <div className="flex gap-1">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <button
            key={p}
            onClick={() => setPct(p)}
            className="flex-1 rounded-xs border border-border py-1 text-xs text-foreground-muted transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {p * 100}%
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-1.5 rounded-sm border border-border-subtle bg-surface-raised/50 p-2.5 text-xs">
        <Row label="Size" value={`${fmt(size, 6)} ${base}`} />
        <Row label="Notional" value={`${fmt(notional)} ${quote}`} />
        <Row
          label="Est. liq. price"
          value={liqPrice > 0 ? fmt(liqPrice) : "—"}
          valueClass={isLong ? "text-price-down" : "text-price-up"}
        />
        <Row label="Open fee" value={`${fmt(openFee)} ${quote}`} />
        <Row label="Cost (margin + fee)" value={`${fmt(cost)} ${quote}`} strong />
      </div>

      <button
        onClick={onSubmit}
        disabled={isPending || marginNum <= 0 || insufficient || lastPrice <= 0}
        className={cn(
          "rounded-sm py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
          isLong
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-danger text-danger-foreground hover:bg-danger/90",
        )}
      >
        {isPending
          ? "Opening…"
          : insufficient && marginNum > 0
            ? "Insufficient balance"
            : `Open ${isLong ? "Long" : "Short"} ${leverage}×`}
      </button>

      {msg && <p className={cn("text-xs", msg.ok ? "text-primary" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
  strong,
}: {
  label: string;
  value: string;
  valueClass?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-foreground-muted">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          strong ? "font-semibold text-foreground" : "text-foreground",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}
