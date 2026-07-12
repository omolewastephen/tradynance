import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { StakingClient, type ProductVM, type PositionVM } from "./staking-client";

export const metadata: Metadata = { title: "Staking — Tradynance" };

const SPOT = "SPOT";

export default async function StakingPage() {
  const session = await requireUser();

  const [products, positions] = await Promise.all([
    prisma.stakingProduct.findMany({
      where: { isActive: true },
      include: { asset: { select: { symbol: true } } },
      orderBy: [{ asset: { symbol: "asc" } }, { lockDays: "asc" }],
    }),
    prisma.stakePosition.findMany({
      where: { userId: session.user.id },
      include: { asset: { select: { symbol: true } }, product: { select: { name: true } } },
      orderBy: { startAt: "desc" },
    }),
  ]);

  // SPOT balances for the assets that have products, so the client can validate amounts.
  const assetIds = [...new Set(products.map((p) => p.assetId))];
  const wallets = await prisma.wallet.findMany({
    where: { userId: session.user.id, network: SPOT, assetId: { in: assetIds } },
    select: { assetId: true, balance: true, lockedBalance: true },
  });
  const balances: Record<string, number> = {};
  for (const w of wallets) balances[w.assetId] = Number(w.balance) - Number(w.lockedBalance);

  const productVMs: ProductVM[] = products.map((p) => ({
    id: p.id,
    assetId: p.assetId,
    symbol: p.asset.symbol,
    name: p.name,
    aprBps: p.aprBps,
    lockDays: p.lockDays,
    minStake: Number(p.minStake),
    available: balances[p.assetId] ?? 0,
  }));

  const positionVMs: PositionVM[] = positions.map((p) => ({
    id: p.id,
    symbol: p.asset.symbol,
    productName: p.product.name,
    principal: Number(p.principal),
    aprBps: p.aprBps,
    lockDays: p.lockDays,
    startAt: p.startAt.toISOString(),
    unlockAt: p.unlockAt ? p.unlockAt.toISOString() : null,
    status: p.status,
    rewardPaid: Number(p.rewardPaid),
    redeemedAt: p.redeemedAt ? p.redeemedAt.toISOString() : null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl animate-fade-rise flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Staking</h1>
        <p className="text-sm text-foreground-muted">
          Earn yield on idle assets. Rewards accrue continuously; flexible products can be redeemed
          anytime, locked products at the end of their term.
        </p>
      </div>
      <StakingClient products={productVMs} positions={positionVMs} />
    </div>
  );
}
