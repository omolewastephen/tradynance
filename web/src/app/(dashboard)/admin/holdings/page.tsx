import Link from "next/link";
import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { ANY_ADMIN_ROLES, SYSTEM_EMAIL } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";

export const metadata: Metadata = { title: "Holdings — Admin" };

function usd(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** symbol → USD price (stables pinned to 1). */
async function priceMap(): Promise<Map<string, number>> {
  const markets = await prisma.market.findMany({
    where: { ticker: { isNot: null } },
    select: { baseAsset: { select: { symbol: true } }, ticker: { select: { lastPrice: true } } },
  });
  const m = new Map<string, number>([["USDT", 1], ["USDC", 1]]);
  for (const mk of markets) if (mk.ticker) m.set(mk.baseAsset.symbol, Number(mk.ticker.lastPrice));
  return m;
}

export default async function AdminHoldingsPage() {
  await requireRole(ANY_ADMIN_ROLES);
  const prices = await priceMap();

  const wallets = await prisma.wallet.findMany({
    where: { balance: { gt: 0 }, user: { email: { not: SYSTEM_EMAIL } } },
    include: {
      user: { select: { id: true, email: true, username: true } },
      asset: { select: { symbol: true } },
    },
  });

  // Platform totals per asset.
  const byAsset = new Map<string, { balance: number; holders: Set<string>; usd: number }>();
  for (const w of wallets) {
    const sym = w.asset.symbol;
    const bal = Number(w.balance);
    const e = byAsset.get(sym) ?? { balance: 0, holders: new Set(), usd: 0 };
    e.balance += bal;
    e.holders.add(w.userId);
    e.usd += bal * (prices.get(sym) ?? 0);
    byAsset.set(sym, e);
  }
  const assetTotals = [...byAsset.entries()]
    .map(([symbol, e]) => ({ symbol, balance: e.balance, holders: e.holders.size, usd: e.usd }))
    .sort((a, b) => b.usd - a.usd);
  const platformUsd = assetTotals.reduce((s, a) => s + a.usd, 0);

  // Every non-zero balance, richest first.
  const rows = wallets
    .map((w) => ({
      userId: w.user.id,
      email: w.user.email,
      username: w.user.username,
      symbol: w.asset.symbol,
      network: w.network ?? "—",
      balance: Number(w.balance),
      available: Number(w.balance) - Number(w.lockedBalance),
      usd: Number(w.balance) * (prices.get(w.asset.symbol) ?? 0),
    }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 300);

  return (
    <div className="flex animate-fade-rise flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Holdings</h1>
        <p className="text-sm text-foreground-muted">
          All user balances across the platform · total custody ≈{" "}
          <span className="font-mono tabular-nums text-foreground">${usd(platformUsd)}</span>
        </p>
      </div>

      {/* per-asset totals */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground-muted">By asset</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assetTotals.map((a) => (
            <Card key={a.symbol} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2.5">
                <CoinIcon symbol={a.symbol} size={26} />
                <div>
                  <div className="text-sm font-medium">{a.symbol}</div>
                  <div className="text-xs text-foreground-muted">{a.holders} holder{a.holders === 1 ? "" : "s"}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm tabular-nums">${usd(a.usd)}</div>
                <div className="font-mono text-xs tabular-nums text-foreground-muted">
                  {a.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* every balance */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground-muted">All balances ({rows.length})</h2>
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>User</th>
                  <th>Asset</th>
                  <th>Network</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
                {rows.map((r, i) => (
                  <tr key={i} className="[&>td]:px-4 [&>td]:py-2.5">
                    <td>
                      <Link href={`/admin/users/${r.userId}`} className="hover:text-primary">
                        {r.username ?? r.email}
                      </Link>
                    </td>
                    <td className="font-medium">{r.symbol}</td>
                    <td className="font-mono text-xs text-foreground-muted">{r.network}</td>
                    <td className="text-right font-mono tabular-nums">
                      {r.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                    <td className="text-right font-mono tabular-nums text-foreground-muted">
                      {r.available.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </td>
                    <td className="text-right font-mono tabular-nums">${usd(r.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
