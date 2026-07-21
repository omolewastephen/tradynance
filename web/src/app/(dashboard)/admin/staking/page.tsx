import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProductForm, ProductRowItem, type ProductRow } from "./product-form";

export const metadata: Metadata = { title: "Staking — Admin — Tradynance" };

export default async function AdminStakingPage() {
  await requireRole([...FINANCE_ROLES]);

  const [products, assets] = await Promise.all([
    prisma.stakingProduct.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { asset: { select: { symbol: true } }, _count: { select: { positions: true } } },
    }),
    prisma.asset.findMany({ orderBy: { symbol: "asc" }, select: { symbol: true } }),
  ]);

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    assetSymbol: p.asset.symbol,
    name: p.name,
    aprPercent: (p.aprBps / 100).toString(),
    lockDays: p.lockDays,
    minStake: p.minStake.toString(),
    isActive: p.isActive,
    positions: p._count.positions,
  }));

  const assetSymbols = assets.map((a) => a.symbol);

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <h1 className="font-display text-h1">Staking products</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Products</span>
            <NewProductForm assets={assetSymbols} />
          </CardTitle>
          <CardDescription>
            What users see on the Staking page. Rewards accrue continuously at the APR you set;
            a 0-day lock is flexible (redeemable anytime). Products with existing positions are
            deactivated rather than deleted, so user funds are never orphaned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              No staking products yet — create one to make the Staking page live for users.
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((p) => (
                <ProductRowItem key={p.id} product={p} assets={assetSymbols} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
