import { Prisma } from "@tradynance/core";
import { prisma } from "../src/lib/prisma";

const D = (n: string) => new Prisma.Decimal(n);
const DAY = 24 * 60 * 60 * 1000;

// Each project sells a new token (its own Asset) for USDT. Idempotent: keyed by project name +
// token symbol. Statuses are illustrative — one LIVE (commit open), one UPCOMING, one DISTRIBUTED
// (claim open) so the whole flow is demoable.
const PROJECTS = [
  {
    name: "NovaChain", tokenSymbol: "NOVA", tokenName: "NovaChain Token",
    price: "0.25", total: "2000000", min: "50", max: "5000",
    status: "LIVE" as const, startOffsetDays: -2, endOffsetDays: 5,
    description: "A high-throughput L1 for on-chain order books. Public sale round.",
  },
  {
    name: "AetherFi", tokenSymbol: "AETH", tokenName: "AetherFi",
    price: "0.80", total: "500000", min: "100", max: "10000",
    status: "UPCOMING" as const, startOffsetDays: 3, endOffsetDays: 10,
    description: "Decentralised perps and structured yield. Whitelist round opens soon.",
  },
  {
    name: "Pulsar", tokenSymbol: "PLSR", tokenName: "Pulsar Protocol",
    price: "0.10", total: "1000000", min: "20", max: "3000",
    status: "DISTRIBUTED" as const, startOffsetDays: -20, endOffsetDays: -10,
    description: "Cross-chain liquidity routing. Sale complete — tokens claimable.",
  },
];

export async function seedLaunchpad() {
  const usdt = await prisma.asset.findUnique({ where: { symbol: "USDT" } });
  if (!usdt) {
    console.log("[seed] launchpad skipped — USDT asset missing");
    return;
  }
  let created = 0;
  for (const p of PROJECTS) {
    const existing = await prisma.launchpadProject.findFirst({ where: { name: p.name } });
    if (existing) continue;

    // The sale token as its own Asset (not tradable/depositable yet — launchpad-only).
    const token = await prisma.asset.upsert({
      where: { symbol: p.tokenSymbol },
      update: {},
      create: { symbol: p.tokenSymbol, name: p.tokenName, decimals: 18, isActive: false },
    });

    const now = Date.now();
    await prisma.launchpadProject.create({
      data: {
        name: p.name,
        tokenSymbol: p.tokenSymbol,
        tokenAssetId: token.id,
        saleAssetId: usdt.id,
        tokenPrice: D(p.price),
        totalAllocation: D(p.total),
        minCommit: D(p.min),
        maxCommit: D(p.max),
        startAt: new Date(now + p.startOffsetDays * DAY),
        endAt: new Date(now + p.endOffsetDays * DAY),
        status: p.status,
        description: p.description,
      },
    });
    created++;
  }
  console.log(`[seed] launchpad projects: ${created} created (${PROJECTS.length} total)`);
}
