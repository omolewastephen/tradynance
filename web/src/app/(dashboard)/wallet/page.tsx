import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownToLine } from "lucide-react";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getUsdPrices } from "@/lib/prices";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";

export const metadata: Metadata = { title: "Wallet — Tradynance" };

export default async function WalletPage() {
  const session = await requireUser();

  const [assets, wallets, prices] = await Promise.all([
    prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { symbol: "asc" },
      include: { networks: { where: { isActive: true } } },
    }),
    prisma.wallet.findMany({ where: { userId: session.user.id } }),
    getUsdPrices(),
  ]);

  // Aggregate balance + locked per asset across networks.
  const byAsset = new Map<string, { balance: number; locked: number }>();
  for (const w of wallets) {
    const cur = byAsset.get(w.assetId) ?? { balance: 0, locked: 0 };
    cur.balance += Number(w.balance);
    cur.locked += Number(w.lockedBalance);
    byAsset.set(w.assetId, cur);
  }

  let totalUsd = 0;
  for (const a of assets) {
    const bal = byAsset.get(a.id)?.balance ?? 0;
    const price = prices.get(a.symbol);
    if (price !== undefined) totalUsd += price * bal;
  }

  const num = (n: number, max = 8) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max });

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 tracking-tight">Wallet</h1>
          <p className="text-foreground-muted">Balances and deposit addresses.</p>
        </div>
        <div className="text-right">
          <span className="text-micro uppercase tracking-wide text-foreground-muted">
            Estimated value
          </span>
          <div className="font-mono text-data-lg tabular-nums">${num(totalUsd, 2)}</div>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
                <th className="py-3 pl-5 font-medium">Asset</th>
                <th className="py-3 pr-4 text-right font-medium">Total</th>
                <th className="py-3 pr-4 text-right font-medium">Available</th>
                <th className="py-3 pr-4 text-right font-medium">In order</th>
                <th className="py-3 pr-4 text-right font-medium">Value (USD)</th>
                <th className="py-3 pr-5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const agg = byAsset.get(asset.id) ?? { balance: 0, locked: 0 };
                const available = agg.balance - agg.locked;
                const price = prices.get(asset.symbol);
                const value = price !== undefined ? price * agg.balance : null;
                const has = agg.balance > 0;
                return (
                  <tr
                    key={asset.id}
                    className="border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-raised/60"
                  >
                    <td className="py-3.5 pl-5">
                      <div className="flex items-center gap-3">
                        <CoinIcon symbol={asset.symbol} size={30} />
                        <div className="flex flex-col">
                          <span className="font-medium">{asset.symbol}</span>
                          <span className="text-xs text-foreground-muted">{asset.name}</span>
                        </div>
                      </div>
                    </td>
                    <td
                      className={
                        "py-3.5 pr-4 text-right font-mono tabular-nums " +
                        (has ? "" : "text-foreground-muted")
                      }
                    >
                      {num(agg.balance)}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-foreground-muted">
                      {num(available)}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-foreground-muted">
                      {num(agg.locked)}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-foreground-muted">
                      {value !== null ? `$${num(value, 2)}` : "—"}
                    </td>
                    <td className="py-3.5 pr-5 text-right">
                      <Link
                        href={`/wallet/deposit/${asset.symbol}`}
                        className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground-muted transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        <ArrowDownToLine className="size-3.5" />
                        Deposit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
