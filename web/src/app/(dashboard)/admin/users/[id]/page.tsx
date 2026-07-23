import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserControls } from "./user-controls";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(USER_ADMIN_ROLES);
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      wallets: { include: { asset: { select: { symbol: true } } } },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { asset: { select: { symbol: true } } },
      },
      _count: { select: { orders: true, deposits: true, withdrawals: true, conversions: true } },
    },
  });
  if (!user) notFound();

  // Aggregate balances per asset (skip zero).
  const byAsset = new Map<string, number>();
  for (const w of user.wallets) {
    byAsset.set(w.asset.symbol, (byAsset.get(w.asset.symbol) ?? 0) + Number(w.balance));
  }
  const holdings = [...byAsset.entries()].filter(([, v]) => v > 0);

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/users" className="text-sm text-accent hover:underline">
            ← Users
          </Link>
          <h1 className="mt-1 font-display text-h1 tracking-tight">{user.email}</h1>
          <p className="font-mono text-sm text-foreground-muted">
            @{user.username} · {user.role} · {user.status} · KYC {user.kycStatus}
          </p>
        </div>
        {/* Jumps to the manual-credit form with this user preselected. Safe for everyone who can
            see this page: USER_ADMIN_ROLES is a subset of the deposits page's FINANCE_ROLES. */}
        <Link
          href={`/admin/deposits?user=${encodeURIComponent(user.email)}#manual-credit`}
          className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Landmark className="size-4" />
          Credit deposit
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <UserControls
              userId={user.id}
              status={user.status}
              role={user.role}
              kyc={user.kycStatus}
              twoFactorEnabled={user.twoFactorEnabled ?? false}
              canManageRoles={session.user.role === "SUPER_ADMIN"}
              isSelf={user.id === session.user.id}
              targetIsSuperAdmin={user.role === "SUPER_ADMIN"}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-foreground-muted">Country</dt>
                <dd>{user.country ?? "—"}</dd>
                <dt className="text-foreground-muted">Phone</dt>
                <dd>{user.phone ?? "—"}</dd>
                <dt className="text-foreground-muted">Email verified</dt>
                <dd>{user.emailVerified ? "Yes" : "No"}</dd>
                <dt className="text-foreground-muted">Referral code</dt>
                <dd className="font-mono">{user.referralCode}</dd>
                <dt className="text-foreground-muted">Joined</dt>
                <dd>{user.createdAt.toLocaleString()}</dd>
                <dt className="text-foreground-muted">Activity</dt>
                <dd className="font-mono text-xs">
                  {user._count.orders} orders · {user._count.deposits} dep ·{" "}
                  {user._count.withdrawals} wd · {user._count.conversions} conv
                </dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Balances</CardTitle>
            </CardHeader>
            <CardContent>
              {holdings.length === 0 ? (
                <p className="text-sm text-foreground-muted">No balances.</p>
              ) : (
                <div className="flex flex-col gap-1 text-sm">
                  {holdings.map(([sym, amt]) => (
                    <div key={sym} className="flex justify-between border-b border-border-subtle py-1.5 last:border-0">
                      <span className="font-medium">{sym}</span>
                      <span className="font-mono tabular-nums">
                        {amt.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent ledger</CardTitle>
          <a
            href={`/admin/transactions?q=${encodeURIComponent(user.email)}`}
            className="text-xs text-accent hover:underline"
          >
            View all transactions →
          </a>
        </CardHeader>
        <CardContent>
          {user.ledgerEntries.length === 0 ? (
            <p className="text-sm text-foreground-muted">No ledger entries.</p>
          ) : (
            <div className="flex flex-col">
              {user.ledgerEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b border-border-subtle py-2 text-sm last:border-0">
                  <span className="text-foreground-muted">{e.type.replace(/_/g, " ")}</span>
                  <span className={"font-mono tabular-nums " + (e.amount.isNegative() ? "text-price-down" : "text-price-up")}>
                    {e.amount.isNegative() ? "" : "+"}
                    {Number(e.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} {e.asset.symbol}
                  </span>
                  <span className="text-xs text-foreground-muted">{e.createdAt.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
