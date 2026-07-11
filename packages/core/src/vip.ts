// VIP tiers. A user's tier is derived from their trailing-30-day trading volume (spot filled
// quote + futures notional), and grants a discount on trading fees. The discount is applied by
// having the ACTION layer compute the user's effective taker-fee bps from their tier and pass it
// as an override into the settlement functions (placeOrder / openPosition), so the money-critical
// engine only gains an optional `takerFeeBpsOverride ?? market.takerFeeBps` — no volume queries
// in the hot transaction. VIP0 (no volume) → no override → base fees, so existing behaviour and
// the conservation tests are unchanged.
//
// Scope: the taker fee is discounted (the primary, most-visible case: spot taker + futures open/
// close, which are all taker). Maker-side discounts are deferred — resting liquidity is quoted by
// the system market-maker, and a maker fee is charged in the counterparty-taker's transaction
// where the maker's own tier isn't in scope.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";

const D = Prisma.Decimal;

export interface VipTier {
  level: number;
  name: string;
  min30dVolume: number; // USDT (quote)
  takerDiscountBps: number; // fraction of base fee waived, in bps (10000 = 100%)
  makerDiscountBps: number; // informational (maker discount deferred in settlement)
}

// Thresholds are illustrative but coherent (climbing volume → deeper discount).
export const VIP_TIERS: VipTier[] = [
  { level: 0, name: "VIP 0", min30dVolume: 0, takerDiscountBps: 0, makerDiscountBps: 0 },
  { level: 1, name: "VIP 1", min30dVolume: 50_000, takerDiscountBps: 1000, makerDiscountBps: 500 },
  { level: 2, name: "VIP 2", min30dVolume: 250_000, takerDiscountBps: 2000, makerDiscountBps: 1000 },
  { level: 3, name: "VIP 3", min30dVolume: 1_000_000, takerDiscountBps: 2500, makerDiscountBps: 1500 },
  { level: 4, name: "VIP 4", min30dVolume: 5_000_000, takerDiscountBps: 3500, makerDiscountBps: 2000 },
];

/** Highest tier whose volume threshold the given 30d volume meets. */
export function vipTierFor(volume30d: number): VipTier {
  let tier = VIP_TIERS[0];
  for (const t of VIP_TIERS) if (volume30d >= t.min30dVolume) tier = t;
  return tier;
}

/** The next tier up, or null if already at the top. */
export function nextVipTier(tier: VipTier): VipTier | null {
  return VIP_TIERS.find((t) => t.level === tier.level + 1) ?? null;
}

/** Base fee bps after a tier's taker discount, rounded to the nearest bp (never below 0). */
export function effectiveTakerBps(baseBps: number, tier: VipTier): number {
  const discounted = baseBps * (1 - tier.takerDiscountBps / 10_000);
  return Math.max(0, Math.round(discounted));
}

/**
 * The VIP-discounted taker-fee bps for a user on a market, or undefined when no discount applies
 * (VIP0) so callers can pass it straight through as an optional override. One convenience the
 * action layer uses so the settlement engines never run volume queries in their hot transaction.
 */
export async function effectiveTakerBpsForUser(
  prisma: PrismaClient,
  userId: string,
  marketSymbol: string,
): Promise<number | undefined> {
  const tier = vipTierFor(await get30dVolume(prisma, userId));
  if (tier.takerDiscountBps <= 0) return undefined;
  const market = await prisma.market.findUnique({
    where: { symbol: marketSymbol },
    select: { takerFeeBps: true },
  });
  if (!market) return undefined;
  return effectiveTakerBps(market.takerFeeBps, tier);
}

/** Trailing-30-day trading volume in quote (USDT): spot filled quote + futures notional. */
export async function get30dVolume(prisma: PrismaClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const spot = await prisma.order.aggregate({
    _sum: { cumulativeQuote: true },
    where: { userId, createdAt: { gte: since } },
  });

  const positions = await prisma.futuresPosition.findMany({
    where: { userId, openedAt: { gte: since } },
    select: { size: true, entryPrice: true },
  });
  const futures = positions.reduce(
    (sum, p) => sum.plus(new D(p.size).times(p.entryPrice)),
    new D(0),
  );

  return Number(new D(spot._sum.cumulativeQuote ?? 0).plus(futures));
}
