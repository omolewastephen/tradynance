import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewActions } from "./review-actions";

export const metadata: Metadata = { title: "Withdrawals — Admin — Tradynance" };

export default async function AdminWithdrawalsPage() {
  await requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE"]);

  const [pending, recent] = await Promise.all([
    prisma.withdrawal.findMany({
      where: { status: { in: ["PENDING", "APPROVED", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true } }, asset: { select: { symbol: true } } },
    }),
    prisma.withdrawal.findMany({
      where: { status: { in: ["COMPLETED", "REJECTED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { email: true } }, asset: { select: { symbol: true } } },
    }),
  ]);

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <h1 className="font-display text-h1">Withdrawals</h1>

      <Card>
        <CardHeader>
          <CardTitle>Awaiting approval</CardTitle>
          <CardDescription>
            Funds are already locked. Approve to settle (writes the ledger debit) or reject to
            release the hold back to the user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing awaiting approval.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border-subtle bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-mono tabular-nums">{w.amount.toString()}</span>{" "}
                      <span className="font-medium">{w.asset.symbol}</span>{" "}
                      <span className="font-mono text-xs text-foreground-muted">
                        + {w.fee.toString()} fee · {w.network}
                      </span>
                    </div>
                    <div className="text-xs text-foreground-muted">{w.user.email}</div>
                    <div className="truncate font-mono text-xs text-foreground-muted">
                      → {w.destinationAddress}
                    </div>
                  </div>
                  <ReviewActions withdrawalId={w.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-foreground-muted">No completed withdrawals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
                    <th className="py-2 pr-4 font-medium">User</th>
                    <th className="py-2 pr-4 font-medium">Asset</th>
                    <th className="py-2 pr-4 text-right font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Network</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((w) => (
                    <tr key={w.id} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 pr-4">{w.user.email}</td>
                      <td className="py-2 pr-4">{w.asset.symbol}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums">
                        {w.amount.toString()}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{w.network}</td>
                      <td className="py-2 text-xs">{w.status.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
