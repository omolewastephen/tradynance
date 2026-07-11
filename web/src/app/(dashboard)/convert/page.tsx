import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvertForm, type ConvertAsset } from "./convert-form";

export const metadata: Metadata = { title: "Convert — Tradynance" };

const SPOT = "SPOT";

export default async function ConvertPage() {
  const session = await requireUser();

  const [assets, spotWallets, conversions] = await Promise.all([
    prisma.asset.findMany({ where: { isActive: true }, orderBy: { symbol: "asc" } }),
    prisma.wallet.findMany({ where: { userId: session.user.id, network: SPOT } }),
    prisma.conversion.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        fromAsset: { select: { symbol: true } },
        toAsset: { select: { symbol: true } },
      },
    }),
  ]);

  const availByAsset = new Map<string, number>();
  for (const w of spotWallets) {
    availByAsset.set(w.assetId, Number(w.balance) - Number(w.lockedBalance));
  }

  const assetData: ConvertAsset[] = assets.map((a) => ({
    symbol: a.symbol,
    name: a.name,
    available: availByAsset.get(a.id) ?? 0,
  }));

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Convert</h1>
        <p className="text-foreground-muted">
          Instantly swap between assets at market price. Uses your SPOT balance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Swap</CardTitle>
          </CardHeader>
          <CardContent>
            <ConvertForm assets={assetData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion history</CardTitle>
          </CardHeader>
          <CardContent>
            {conversions.length === 0 ? (
              <p className="text-sm text-foreground-muted">No conversions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
                      <th className="py-2 pr-4 font-medium">From</th>
                      <th className="py-2 pr-4 font-medium">To</th>
                      <th className="py-2 pr-4 text-right font-medium">Rate</th>
                      <th className="py-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversions.map((c) => (
                      <tr key={c.id} className="border-b border-border-subtle last:border-0">
                        <td className="py-2 pr-4 font-mono tabular-nums">
                          {Number(c.fromAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                          {c.fromAsset.symbol}
                        </td>
                        <td className="py-2 pr-4 font-mono tabular-nums text-price-up">
                          {Number(c.toAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                          {c.toAsset.symbol}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums text-foreground-muted">
                          {Number(c.rate).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        </td>
                        <td className="py-2 text-xs text-foreground-muted">
                          {c.createdAt.toLocaleString()}
                        </td>
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
