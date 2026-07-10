"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { cancelUserOrder } from "../actions";

export type OrderRow = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  price: string | null;
  quantity: string;
  filledQuantity: string;
  avgFillPrice: string | null;
  status: string;
  createdAt: string;
};

export function OrdersPanel({
  open,
  history,
}: {
  open: OrderRow[];
  history: OrderRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"open" | "history">("open");
  const [isPending, startTransition] = useTransition();
  const rows = tab === "open" ? open : history;

  return (
    <div className="rounded-md border border-border-subtle">
      <div className="flex gap-1 border-b border-border-subtle p-1">
        {(["open", "history"] as const).map((t) => (
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
            {t === "open" ? `Open orders (${open.length})` : "Order history"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
              <th className="py-2 pl-4 font-medium">Pair</th>
              <th className="py-2 pr-4 font-medium">Side</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 text-right font-medium">Price</th>
              <th className="py-2 pr-4 text-right font-medium">Amount</th>
              <th className="py-2 pr-4 text-right font-medium">Filled</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              {tab === "open" && <th className="py-2 pr-4 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sm text-foreground-muted">
                  {tab === "open" ? "No open orders." : "No order history yet."}
                </td>
              </tr>
            )}
            {rows.map((o) => {
              const filledPct =
                (Number(o.filledQuantity) / Number(o.quantity)) * 100 || 0;
              return (
                <tr key={o.id} className="border-b border-border-subtle last:border-0">
                  <td className="py-2 pl-4 font-medium">{o.symbol}</td>
                  <td
                    className={cn(
                      "py-2 pr-4",
                      o.side === "BUY" ? "text-price-up" : "text-price-down",
                    )}
                  >
                    {o.side}
                  </td>
                  <td className="py-2 pr-4 text-xs text-foreground-muted">{o.type}</td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums">
                    {o.price ? Number(o.price).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "Market"}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums">
                    {Number(o.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground-muted">
                    {filledPct.toFixed(0)}%
                  </td>
                  <td className="py-2 pr-4 text-xs">{o.status.replace(/_/g, " ")}</td>
                  {tab === "open" && (
                    <td className="py-2 pr-4">
                      <button
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await cancelUserOrder(o.id);
                            router.refresh();
                          })
                        }
                        className="text-xs text-danger hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
