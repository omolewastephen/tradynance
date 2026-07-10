import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WithdrawForm, type WithdrawAsset } from "./withdraw-form";

export const metadata: Metadata = { title: "Withdraw — Tradynance" };

export default async function WithdrawPage() {
  const session = await requireUser();

  const [assets, wallets, whitelist, recent] = await Promise.all([
    prisma.asset.findMany({
      where: { isActive: true },
      orderBy: { symbol: "asc" },
      include: { networks: { where: { isActive: true }, orderBy: { network: "asc" } } },
    }),
    prisma.wallet.findMany({ where: { userId: session.user.id } }),
    prisma.withdrawalWhitelist.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.withdrawal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { asset: { select: { symbol: true } } },
    }),
  ]);

  // available (balance − locked) keyed by `${assetId}:${network}`
  const available: Record<string, number> = {};
  for (const w of wallets) {
    if (!w.network) continue;
    available[`${w.assetId}:${w.network}`] =
      Number(w.balance) - Number(w.lockedBalance);
  }

  const assetData: WithdrawAsset[] = assets.map((a) => ({
    id: a.id,
    symbol: a.symbol,
    name: a.name,
    networks: a.networks.map((n) => ({
      network: n.network,
      withdrawalFee: n.withdrawalFee.toString(),
      requiresMemo: n.requiresMemo,
    })),
  }));

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Withdraw</h1>
        <p className="text-foreground-muted">Send crypto to an external address.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>New withdrawal</CardTitle>
          </CardHeader>
          <CardContent>
            <WithdrawForm
              assets={assetData}
              available={available}
              whitelist={whitelist.map((w) => ({
                network: w.network,
                address: w.address,
                label: w.label,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent withdrawals</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-foreground-muted">No withdrawals yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
                      <th className="py-2 pr-4 font-medium">Asset</th>
                      <th className="py-2 pr-4 text-right font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Network</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((w) => (
                      <tr key={w.id} className="border-b border-border-subtle last:border-0">
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
    </div>
  );
}
