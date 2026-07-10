import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownToLine } from "lucide-react";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";

export const metadata: Metadata = { title: "Wallet — Tradynance" };

export default async function WalletPage() {
  const session = await requireUser();

  const [assets, wallets] = await Promise.all([
    prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { symbol: "asc" },
      include: { networks: { where: { isActive: true } } },
    }),
    prisma.wallet.findMany({ where: { userId: session.user.id } }),
  ]);

  const balanceByAsset = new Map<string, number>();
  for (const w of wallets) {
    balanceByAsset.set(w.assetId, (balanceByAsset.get(w.assetId) ?? 0) + Number(w.balance));
  }

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Wallet</h1>
        <p className="text-foreground-muted">Balances and deposit addresses.</p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[1fr_auto_5rem] items-center gap-4 border-b border-border-subtle px-5 py-3 text-micro uppercase tracking-wide text-foreground-muted">
          <span>Asset</span>
          <span className="text-right">Balance</span>
          <span className="text-right">Action</span>
        </div>
        {assets.map((asset) => {
          const balance = balanceByAsset.get(asset.id) ?? 0;
          return (
            <div
              key={asset.id}
              className="grid grid-cols-[1fr_auto_5rem] items-center gap-4 border-b border-border-subtle px-5 py-3.5 transition-colors last:border-0 hover:bg-surface-raised/60"
            >
              <div className="flex items-center gap-3">
                <CoinIcon symbol={asset.symbol} size={32} />
                <div className="flex flex-col">
                  <span className="font-medium">{asset.symbol}</span>
                  <span className="text-sm text-foreground-muted">{asset.name}</span>
                </div>
              </div>
              <span
                className={
                  "text-right font-mono text-data tabular-nums " +
                  (balance > 0 ? "text-foreground" : "text-foreground-muted")
                }
              >
                {balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}
              </span>
              <div className="flex justify-end">
                <Link
                  href={`/wallet/deposit/${asset.symbol}`}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs text-foreground-muted transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ArrowDownToLine className="size-3.5" />
                  Deposit
                </Link>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
