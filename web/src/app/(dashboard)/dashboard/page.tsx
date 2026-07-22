import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getUsdPrices } from "@/lib/prices";
import { Card } from "@/components/ui/card";
import { StatusPill, humanize } from "@/components/ui/status-pill";
import { CoinIcon } from "@/components/brand/coin-icon";
import { getAuthMarkets } from "@/components/auth/market-rail";
import { cn } from "@/lib/utils";
import { BalanceHero } from "./balance-hero";

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <span className="text-micro uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      <div className="mt-2">{value}</div>
      {hint && <span className="mt-1.5 block text-xs text-foreground-muted">{hint}</span>}
    </Card>
  );
}

const fmtPrice = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });

const fmtAmount = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 8 });

export default async function DashboardPage() {
  const session = await requireUser();

  const [wallets, prices, markets, activity] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: session.user.id },
      include: { asset: { select: { symbol: true } } },
    }),
    getUsdPrices(),
    // Same live snapshot the auth pages use — one shared Ticker query, server-rendered.
    getAuthMarkets(5),
    prisma.ledgerEntry.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { asset: { select: { symbol: true } } },
    }),
  ]);

  let totalUsd = 0;
  for (const w of wallets) {
    const price = prices.get(w.asset.symbol);
    if (price !== undefined) totalUsd += price * Number(w.balance);
  }
  const assetsHeld = wallets.filter((w) => Number(w.balance) > 0).length;

  const kyc = session.user.kycStatus as string;
  const displayName =
    (session.user as { displayUsername?: string | null }).displayUsername ??
    (session.user as { username?: string | null }).username ??
    session.user.email;

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Overview</h1>
        <p className="text-foreground-muted">Welcome back, {displayName}</p>
      </div>

      <BalanceHero totalUsd={totalUsd} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Assets held"
          value={<span className="font-mono text-data-lg tabular-nums">{assetsHeld}</span>}
          hint={`${wallets.length} wallets`}
        />
        <StatTile
          label="Identity"
          value={<StatusPill status={kyc} />}
          hint={
            kyc === "UNVERIFIED" || kyc === "REJECTED" ? (
              <Link href="/settings/kyc" className="text-accent hover:underline">
                Verify now →
              </Link>
            ) : kyc === "PENDING" ? (
              "Under review"
            ) : (
              "Withdrawals enabled"
            )
          }
        />
        <StatTile
          label="Account"
          value={<span className="text-lg font-medium">{humanize(session.user.role as string)}</span>}
        />
        <StatTile label="Status" value={<StatusPill status={session.user.status as string} />} />
      </div>

      {/* Live market + personal activity — an exchange overview should show the market. */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-h4">Markets</h2>
            <Link
              href="/markets"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {markets.length === 0 ? (
            <p className="py-6 text-sm text-foreground-muted">Market data is warming up.</p>
          ) : (
            <div className="flex flex-col">
              {markets.map((m) => {
                const up = m.changePct >= 0;
                return (
                  <Link
                    key={m.symbol}
                    href={`/markets/${m.symbol}USDT`}
                    className="-mx-2 flex items-center justify-between gap-4 rounded-sm px-2 py-2.5 transition-colors hover:bg-surface-raised/50"
                  >
                    <span className="flex items-center gap-2.5">
                      <CoinIcon symbol={m.symbol} size={26} />
                      <span className="text-sm font-medium">
                        {m.symbol}
                        <span className="text-foreground-subtle">/USDT</span>
                      </span>
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-sm tabular-nums">${fmtPrice(m.price)}</span>
                      <span
                        className={cn(
                          "w-20 text-right font-mono text-xs tabular-nums",
                          up ? "text-primary" : "text-danger",
                        )}
                      >
                        {up ? "▲" : "▼"} {Math.abs(m.changePct).toFixed(2)}%
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-h4">Recent activity</h2>
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              Portfolio <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {activity.length === 0 ? (
            <div className="py-6 text-sm text-foreground-muted">
              <p>No activity yet.</p>
              <Link href="/wallet" className="mt-1 inline-block text-accent hover:underline">
                Make your first deposit →
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col">
              {activity.map((e) => {
                const amt = Number(e.amount);
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 text-sm last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{humanize(e.type)}</span>
                      <span className="text-xs text-foreground-subtle">
                        {e.createdAt.toLocaleDateString()}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-xs tabular-nums",
                        amt >= 0 ? "text-primary" : "text-danger",
                      )}
                    >
                      {amt >= 0 ? "+" : ""}
                      {fmtAmount(amt)} {e.asset.symbol}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {totalUsd === 0 && (
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-h4">Fund your account to start trading</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Deposit crypto to your wallet and your balance will be valued here live in USD.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/wallet" className="text-accent hover:underline">
                  Go to Wallet →
                </Link>
                <Link href="/markets" className="text-accent hover:underline">
                  View markets →
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
