import Link from "next/link";
import type { Metadata } from "next";

import { Prisma } from "@tradynance/core";
import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { ANY_ADMIN_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Transactions — Admin" };

const PAGE_SIZE = 50;
const TYPES = [
  "DEPOSIT", "WITHDRAWAL", "TRADE_FILL", "FEE", "CONVERSION", "ADJUSTMENT",
  "FUTURES_MARGIN", "FUTURES_PNL", "FUNDING", "LIQUIDATION", "REFERRAL_COMMISSION",
  "STAKE", "STAKING_REWARD", "LAUNCHPAD", "NFT", "TRANSFER_IN", "TRANSFER_OUT",
];

function fmt(n: Prisma.Decimal) {
  const v = Number(n);
  return v.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; type?: string }>;
}) {
  await requireRole(ANY_ADMIN_ROLES);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();
  const type = TYPES.includes(sp.type ?? "") ? sp.type : "";

  const where: Prisma.LedgerEntryWhereInput = {
    ...(q ? { user: { email: { contains: q, mode: "insensitive" } } } : {}),
    ...(type ? { type: type as never } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, email: true, username: true } }, asset: { select: { symbol: true } } },
    }),
    prisma.ledgerEntry.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (type) u.set("type", type);
    u.set("page", String(p));
    return `?${u.toString()}`;
  };

  return (
    <div className="flex animate-fade-rise flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Transactions</h1>
        <p className="text-sm text-foreground-muted">
          Append-only ledger — every credit/debit across the platform ({total.toLocaleString()}).
        </p>
      </div>

      {/* filters (GET form) */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Filter by user email…"
          className="h-9 w-64 rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-primary/50"
        />
        <select name="type" defaultValue={type} className="h-9 rounded-sm border border-border bg-surface px-2 text-sm">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Filter
        </button>
        {(q || type) && (
          <Link href="/admin/transactions" className="text-sm text-foreground-muted hover:text-foreground">
            Clear
          </Link>
        )}
      </form>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>When</th>
                <th>User</th>
                <th>Type</th>
                <th>Asset</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance after</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-foreground-muted">
                    No transactions match.
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const amt = Number(e.amount);
                  return (
                    <tr key={e.id} className="[&>td]:px-4 [&>td]:py-2.5">
                      <td className="whitespace-nowrap text-xs text-foreground-muted">
                        {e.createdAt.toLocaleString()}
                      </td>
                      <td className="max-w-40 truncate">
                        <Link href={`/admin/users/${e.user.id}`} className="hover:text-primary">
                          {e.user.username ?? e.user.email}
                        </Link>
                      </td>
                      <td className="font-mono text-xs">{e.type}</td>
                      <td className="font-medium">{e.asset.symbol}</td>
                      <td className={"text-right font-mono tabular-nums " + (amt >= 0 ? "text-price-up" : "text-price-down")}>
                        {amt >= 0 ? "+" : ""}
                        {fmt(e.amount)}
                      </td>
                      <td className="text-right font-mono tabular-nums text-foreground-muted">{fmt(e.balanceAfter)}</td>
                      <td className="max-w-48 truncate text-xs text-foreground-muted">{e.note ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground-muted">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qs(page - 1)} className="rounded-sm border border-border px-3 py-1.5 text-foreground-muted hover:text-foreground">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={qs(page + 1)} className="rounded-sm border border-border px-3 py-1.5 text-foreground-muted hover:text-foreground">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
