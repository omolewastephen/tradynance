"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { submitOrder } from "../actions";

type Side = "BUY" | "SELL";
type OType = "LIMIT" | "MARKET";
type TIF = "GTC" | "IOC" | "FOK";

export function OrderForm({
  symbol,
  base,
  quote,
  availableBase,
  availableQuote,
  lastPrice,
}: {
  symbol: string;
  base: string;
  quote: string;
  availableBase: number;
  availableQuote: number;
  lastPrice: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [side, setSide] = useState<Side>("BUY");
  const [type, setType] = useState<OType>("LIMIT");
  const [tif, setTif] = useState<TIF>("GTC");
  const [price, setPrice] = useState(lastPrice ? String(lastPrice) : "");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const priceNum = type === "MARKET" ? lastPrice : Number(price) || 0;
  const amountNum = Number(amount) || 0;
  const total = priceNum * amountNum;
  const avail = side === "BUY" ? availableQuote : availableBase;

  function setPct(pct: number) {
    if (side === "BUY") {
      // spend pct of available quote → base amount at price
      if (priceNum > 0) setAmount(((availableQuote * pct) / priceNum).toFixed(6));
    } else {
      setAmount((availableBase * pct).toFixed(6));
    }
  }

  function onSubmit() {
    setMsg(null);
    startTransition(async () => {
      const res = await submitOrder({
        marketSymbol: symbol,
        side,
        type,
        timeInForce: tif,
        price: type === "LIMIT" ? price : undefined,
        quantity: amount,
      });
      if (res.ok) {
        setMsg({
          ok: true,
          text:
            res.status === "FILLED"
              ? `Filled ${res.filledQty} ${base}${res.avgPrice ? ` @ ${Number(res.avgPrice).toFixed(2)}` : ""}`
              : res.resting
                ? `Order placed (${res.status.toLowerCase().replace("_", " ")})`
                : `Order ${res.status.toLowerCase()}`,
        });
        setAmount("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-1 rounded-sm border border-border-subtle p-1">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "rounded-xs py-1.5 text-sm font-medium transition-colors",
              side === s
                ? s === "BUY"
                  ? "bg-primary text-primary-foreground"
                  : "bg-danger text-danger-foreground"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {s === "BUY" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* Limit / Market */}
      <div className="flex gap-3 text-sm">
        {(["LIMIT", "MARKET"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "transition-colors",
              type === t ? "font-medium text-foreground" : "text-foreground-muted",
            )}
          >
            {t === "LIMIT" ? "Limit" : "Market"}
          </button>
        ))}
      </div>

      <div className="flex justify-between text-xs text-foreground-muted">
        <span>Available</span>
        <span className="font-mono tabular-nums">
          {avail.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
          {side === "BUY" ? quote : base}
        </span>
      </div>

      {type === "LIMIT" && (
        <label htmlFor="order-price" className="flex flex-col gap-1 text-xs text-foreground-muted">
          Price ({quote})
          <Input
            id="order-price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className="font-mono"
          />
        </label>
      )}

      <label htmlFor="order-amount" className="flex flex-col gap-1 text-xs text-foreground-muted">
        Amount ({base})
        <Input
          id="order-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="font-mono"
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

      {type === "LIMIT" && (
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <span>Time in force</span>
          <select
            value={tif}
            onChange={(e) => setTif(e.target.value as TIF)}
            className="rounded-xs border border-border bg-surface px-2 py-1 text-foreground"
          >
            <option value="GTC">GTC</option>
            <option value="IOC">IOC</option>
            <option value="FOK">FOK</option>
          </select>
        </div>
      )}

      <div className="flex justify-between text-xs text-foreground-muted">
        <span>Total</span>
        <span className="font-mono tabular-nums">
          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {quote}
        </span>
      </div>

      <button
        onClick={onSubmit}
        disabled={isPending || amountNum <= 0 || (type === "LIMIT" && priceNum <= 0)}
        className={cn(
          "rounded-sm py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
          side === "BUY"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-danger text-danger-foreground hover:bg-danger/90",
        )}
      >
        {isPending ? "Submitting…" : `${side === "BUY" ? "Buy" : "Sell"} ${base}`}
      </button>

      {msg && (
        <p className={cn("text-xs", msg.ok ? "text-primary" : "text-danger")}>{msg.text}</p>
      )}
    </div>
  );
}
