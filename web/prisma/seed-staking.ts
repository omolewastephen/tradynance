import { Prisma } from "@tradynance/core";
import { prisma } from "../src/lib/prisma";

const D = (n: string) => new Prisma.Decimal(n);

// Staking products by base-asset symbol. Idempotent: keyed by (assetId, name).
const PRODUCTS: { symbol: string; name: string; aprBps: number; lockDays: number; minStake: string }[] = [
  { symbol: "USDT", name: "USDT Flexible", aprBps: 800, lockDays: 0, minStake: "10" },
  { symbol: "USDT", name: "USDT 30-Day", aprBps: 1200, lockDays: 30, minStake: "50" },
  { symbol: "USDT", name: "USDT 90-Day", aprBps: 1600, lockDays: 90, minStake: "100" },
  { symbol: "BTC", name: "BTC Flexible", aprBps: 250, lockDays: 0, minStake: "0.001" },
  { symbol: "ETH", name: "ETH 30-Day", aprBps: 500, lockDays: 30, minStake: "0.01" },
  { symbol: "SOL", name: "SOL 60-Day", aprBps: 900, lockDays: 60, minStake: "1" },
];

export async function seedStaking() {
  let created = 0;
  for (const p of PRODUCTS) {
    const asset = await prisma.asset.findUnique({ where: { symbol: p.symbol } });
    if (!asset) continue;
    const existing = await prisma.stakingProduct.findFirst({
      where: { assetId: asset.id, name: p.name },
    });
    if (existing) continue;
    await prisma.stakingProduct.create({
      data: {
        assetId: asset.id,
        name: p.name,
        aprBps: p.aprBps,
        lockDays: p.lockDays,
        minStake: D(p.minStake),
      },
    });
    created++;
  }
  console.log(`[seed] staking products: ${created} created (${PRODUCTS.length} total)`);
}
