import Link from "next/link";
import { Wallet } from "lucide-react";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getUsdPrices } from "@/lib/prices";
import { Card } from "@/components/ui/card";
import { BalanceHero } from "./balance-hero";

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <span className="text-micro uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      <div className="mt-2 font-mono text-data-lg tabular-nums">{value}</div>
      {hint && <span className="mt-1 block text-xs text-foreground-muted">{hint}</span>}
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();

  const [wallets, prices] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: session.user.id },
      include: { asset: { select: { symbol: true } } },
    }),
    getUsdPrices(),
  ]);

  let totalUsd = 0;
  for (const w of wallets) {
    const price = prices.get(w.asset.symbol);
    if (price !== undefined) totalUsd += price * Number(w.balance);
  }
  const assetsHeld = wallets.filter((w) => Number(w.balance) > 0).length;

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Overview</h1>
        <p className="text-foreground-muted">Welcome back, {session.user.email}</p>
      </div>

      <BalanceHero totalUsd={totalUsd} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Assets held" value={assetsHeld} hint={`${wallets.length} wallets`} />
        <StatTile
          label="KYC status"
          value={<span className="text-lg">{session.user.kycStatus as string}</span>}
        />
        <StatTile
          label="Account"
          value={<span className="text-lg">{session.user.role as string}</span>}
        />
        <StatTile
          label="Status"
          value={<span className="text-lg text-primary">{session.user.status as string}</span>}
        />
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-h4">Explore the markets</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Live prices for 14 pairs, candlestick charts, and a watchlist. Fund your account
              to see its value here in USD.
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <Link href="/markets" className="text-accent hover:underline">
                View markets →
              </Link>
              <Link href="/wallet" className="text-accent hover:underline">
                Go to Wallet →
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
