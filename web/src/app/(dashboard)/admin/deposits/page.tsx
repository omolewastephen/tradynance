import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManualCreditForm } from "./manual-credit-form";

export const metadata: Metadata = { title: "Deposits — Admin — Tradynance" };

export default async function AdminDepositsPage() {
  await requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE"]);

  const [pending, recent] = await Promise.all([
    prisma.deposit.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { email: true } }, asset: { select: { symbol: true } } },
    }),
    prisma.deposit.findMany({
      where: { status: "CREDITED" },
      orderBy: { creditedAt: "desc" },
      take: 15,
      include: { user: { select: { email: true } }, asset: { select: { symbol: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1">Deposits</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manual deposit credit</CardTitle>
          <CardDescription>
            Fallback for networks without automated chain-watching. Credits via the same
            ledger path as the watcher, so balances stay consistent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManualCreditForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending / awaiting confirmation</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing pending.</p>
          ) : (
            <DepositTable rows={pending} showConfirmations />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently credited</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-foreground-muted">No credited deposits yet.</p>
          ) : (
            <DepositTable rows={recent} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type Row = {
  id: string;
  amount: { toString(): string };
  network: string;
  status: string;
  source: string;
  confirmations: number;
  user: { email: string };
  asset: { symbol: string };
};

function DepositTable({ rows, showConfirmations }: { rows: Row[]; showConfirmations?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Asset</th>
            <th className="py-2 pr-4 text-right font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Network</th>
            <th className="py-2 pr-4 font-medium">Source</th>
            {showConfirmations && <th className="py-2 pr-4 text-right font-medium">Conf.</th>}
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-border-subtle last:border-0">
              <td className="py-2 pr-4">{d.user.email}</td>
              <td className="py-2 pr-4">{d.asset.symbol}</td>
              <td className="py-2 pr-4 text-right font-mono tabular-nums">
                {d.amount.toString()}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{d.network}</td>
              <td className="py-2 pr-4 text-xs">{d.source}</td>
              {showConfirmations && (
                <td className="py-2 pr-4 text-right font-mono tabular-nums">
                  {d.confirmations}
                </td>
              )}
              <td className="py-2">{d.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
