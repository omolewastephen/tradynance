"use client";

import { useRouter } from "next/navigation";

export function PairSelect({
  symbol,
  markets,
  basePath = "/trade",
}: {
  symbol: string;
  markets: { symbol: string; base: string }[];
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={symbol}
      onChange={(e) => router.push(`${basePath}/${e.target.value}`)}
      className="rounded-sm border border-border bg-surface px-3 py-2 font-mono text-sm font-medium text-foreground"
    >
      {markets.map((m) => (
        <option key={m.symbol} value={m.symbol}>
          {m.base}/USDT
        </option>
      ))}
    </select>
  );
}
