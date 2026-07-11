"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { CoinIcon } from "@/components/brand/coin-icon";
import { getQuote, executeConvert } from "./actions";

export type ConvertAsset = { symbol: string; name: string; available: number };

export function ConvertForm({ assets }: { assets: ConvertAsset[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(assets.find((a) => a.symbol === "USDT")?.symbol ?? assets[0]?.symbol ?? "");
  const [to, setTo] = useState(assets.find((a) => a.symbol === "BTC")?.symbol ?? assets[1]?.symbol ?? "");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<{ toAmount: number; rate: number; spreadBps: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fromAsset = assets.find((a) => a.symbol === from);
  const amountNum = Number(amount) || 0;

  // Live quote (debounced) as the user types.
  useEffect(() => {
    setQuote(null);
    if (!from || !to || from === to || amountNum <= 0) return;
    const id = setTimeout(async () => {
      const q = await getQuote(from, to, amountNum);
      if (q.ok) setQuote({ toAmount: q.toAmount, rate: q.rate, spreadBps: q.spreadBps });
    }, 300);
    return () => clearTimeout(id);
  }, [from, to, amountNum]);

  function swap() {
    setFrom(to);
    setTo(from);
    setAmount("");
    setMsg(null);
  }

  function onConvert() {
    setMsg(null);
    startTransition(async () => {
      const res = await executeConvert(from, to, amount);
      if (res.ok) {
        setMsg({ ok: true, text: `Converted — received ${Number(res.toAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${to}` });
        setAmount("");
        setQuote(null);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  const insufficient = fromAsset ? amountNum > fromAsset.available : false;

  return (
    <div className="flex flex-col gap-3">
      {/* From */}
      <div className="rounded-md border border-border-subtle bg-surface-raised/40 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-foreground-muted">
          <span>From</span>
          <button
            onClick={() => fromAsset && setAmount(String(fromAsset.available))}
            className="hover:text-foreground"
          >
            Balance:{" "}
            <span className="font-mono tabular-nums">
              {(fromAsset?.available ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-sm border border-border bg-surface px-2 py-1.5">
            <CoinIcon symbol={from} size={22} />
            <SelectNative
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 pr-1 font-medium"
            >
              {assets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol}
                </option>
              ))}
            </SelectNative>
          </div>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="flex-1 border-0 bg-transparent text-right font-mono text-lg"
          />
        </div>
      </div>

      {/* swap */}
      <div className="flex justify-center">
        <button
          onClick={swap}
          className="rounded-full border border-border bg-surface p-2 text-foreground-muted transition-colors hover:text-primary"
          aria-label="Swap direction"
        >
          <ArrowDownUp className="size-4" />
        </button>
      </div>

      {/* To */}
      <div className="rounded-md border border-border-subtle bg-surface-raised/40 p-4">
        <div className="mb-2 text-xs text-foreground-muted">To (estimated)</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-sm border border-border bg-surface px-2 py-1.5">
            <CoinIcon symbol={to} size={22} />
            <SelectNative
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 pr-1 font-medium"
            >
              {assets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol}
                </option>
              ))}
            </SelectNative>
          </div>
          <div className="flex-1 text-right font-mono text-lg tabular-nums">
            {quote ? quote.toAmount.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "0.00"}
          </div>
        </div>
      </div>

      {quote && (
        <div className="flex flex-col gap-1 px-1 text-xs text-foreground-muted">
          <div className="flex justify-between">
            <span>Rate</span>
            <span className="font-mono tabular-nums">
              1 {from} ≈ {quote.rate.toLocaleString(undefined, { maximumFractionDigits: 8 })} {to}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Spread</span>
            <span className="font-mono tabular-nums">{(quote.spreadBps / 100).toFixed(2)}%</span>
          </div>
        </div>
      )}

      <button
        onClick={onConvert}
        disabled={isPending || amountNum <= 0 || from === to || insufficient}
        className="mt-1 rounded-sm bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Converting…" : insufficient ? "Insufficient balance" : "Convert"}
      </button>

      {msg && <p className={cn("text-sm", msg.ok ? "text-primary" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}
