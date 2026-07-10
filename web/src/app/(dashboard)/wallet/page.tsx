import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Wallet — Tradynance" };

export default async function WalletPage() {
  const session = await requireUser();

  // All active assets, plus this user's wallet balances keyed by assetId.
  const [assets, wallets] = await Promise.all([
    prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { symbol: "asc" },
      include: { networks: { where: { isActive: true } } },
    }),
    prisma.wallet.findMany({ where: { userId: session.user.id } }),
  ]);

  // Sum cached balances per asset (a user can have one wallet per network).
  const balanceByAsset = new Map<string, number>();
  for (const w of wallets) {
    balanceByAsset.set(
      w.assetId,
      (balanceByAsset.get(w.assetId) ?? 0) + Number(w.balance),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h1">Wallet</h1>
        <p className="text-foreground-muted">Balances and deposit addresses.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border-subtle px-5 py-3 text-micro uppercase tracking-wide text-foreground-muted">
          <span>Asset</span>
          <span className="text-right">Balance</span>
          <span className="text-right">Action</span>
        </div>
        {assets.map((asset) => {
          const balance = balanceByAsset.get(asset.id) ?? 0;
          return (
            <div
              key={asset.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border-subtle px-5 py-4 last:border-0"
            >
              <div className="flex flex-col">
                <span className="font-medium">{asset.symbol}</span>
                <span className="text-sm text-foreground-muted">{asset.name}</span>
              </div>
              <span className="text-right font-mono text-data tabular-nums">
                {balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}
              </span>
              <div className="text-right">
                <Link
                  href={`/wallet/deposit/${asset.symbol}`}
                  className="text-sm text-accent hover:underline"
                >
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
