"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ShieldCheck, Eye, EyeOff } from "lucide-react";

export function BalanceHero({ totalUsd }: { totalUsd: number }) {
  const [hidden, setHidden] = useState(false);

  const formatted = totalUsd.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="relative overflow-hidden rounded-md border border-border-subtle bg-surface p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="flex items-center gap-2">
        <span className="text-micro uppercase tracking-wide text-foreground-muted">
          Estimated balance
        </span>
        {/* -m-2 keeps the visual footprint small while p-2 grows the hit area to ~32px. */}
        <button
          onClick={() => setHidden((h) => !h)}
          className="-m-2 rounded-sm p-2 text-foreground-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={hidden ? "Show balance" : "Hide balance"}
          aria-pressed={hidden}
        >
          {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums">
          {hidden ? "••••••" : `$${formatted}`}
        </span>
        <span className="font-mono text-sm text-foreground-muted">USD</span>
      </div>
      <p className="mt-1 text-xs text-foreground-muted">
        Valued at live market prices. Assets without a market are excluded.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/wallet"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowDownToLine className="size-4" />
          Deposit
        </Link>
        <Link
          href="/withdraw"
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface"
        >
          <ArrowUpFromLine className="size-4" />
          Withdraw
        </Link>
        <Link
          href="/settings/security"
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface"
        >
          <ShieldCheck className="size-4" />
          Security
        </Link>
      </div>
    </div>
  );
}
