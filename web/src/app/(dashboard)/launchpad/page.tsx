import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { LaunchpadClient, type ProjectVM } from "./launchpad-client";

export const metadata: Metadata = { title: "Launchpad — Tradynance" };

const SPOT = "SPOT";
const ORDER: Record<string, number> = { LIVE: 0, UPCOMING: 1, DISTRIBUTED: 2, ENDED: 3 };

export default async function LaunchpadPage() {
  const session = await requireUser();

  const projects = await prisma.launchpadProject.findMany({
    include: {
      tokenAsset: { select: { symbol: true } },
      saleAsset: { select: { symbol: true, id: true } },
      commitments: { where: { userId: session.user.id } },
    },
  });

  // USDT available (the sale asset for the seeded projects).
  const saleAssetIds = [...new Set(projects.map((p) => p.saleAssetId))];
  const wallets = await prisma.wallet.findMany({
    where: { userId: session.user.id, network: SPOT, assetId: { in: saleAssetIds } },
    select: { assetId: true, balance: true, lockedBalance: true },
  });
  const available: Record<string, number> = {};
  for (const w of wallets) available[w.assetId] = Number(w.balance) - Number(w.lockedBalance);

  const vms: ProjectVM[] = projects
    .map((p) => {
      const mine = p.commitments[0];
      return {
        id: p.id,
        name: p.name,
        tokenSymbol: p.tokenSymbol,
        saleSymbol: p.saleAsset.symbol,
        description: p.description,
        status: p.status,
        tokenPrice: Number(p.tokenPrice),
        totalAllocation: Number(p.totalAllocation),
        soldAllocation: Number(p.soldAllocation),
        minCommit: Number(p.minCommit),
        maxCommit: Number(p.maxCommit),
        startAt: p.startAt.toISOString(),
        endAt: p.endAt.toISOString(),
        available: available[p.saleAssetId] ?? 0,
        myCommitted: mine ? Number(mine.committedAmount) : 0,
        myTokens: mine ? Number(mine.tokenAmount) : 0,
        myClaimed: mine ? mine.claimed : false,
      };
    })
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div className="mx-auto flex w-full max-w-5xl animate-fade-rise flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Launchpad</h1>
        <p className="text-sm text-foreground-muted">
          Commit {vms[0]?.saleSymbol ?? "USDT"} to new token sales and claim your allocation when
          the sale is distributed.
        </p>
      </div>
      <LaunchpadClient projects={vms} />
    </div>
  );
}
