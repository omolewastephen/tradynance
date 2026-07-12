// Staking — lock an asset for yield. Same money discipline as the rest: principal leaves the
// SPOT wallet on stake (a STAKE debit) and returns on redeem (a STAKE credit) alongside the
// earned yield (a STAKING_REWARD credit), each an append-only ledger entry; balance is the cache.
//
// Rewards accrue CONTINUOUSLY and are computed on demand from elapsed time — there's no separate
// accrual job to drift out of sync. For a locked product, accrual is capped at the lock period
// (you don't keep earning past unlock); a flexible product (lockDays = 0) accrues for as long as
// it's held. Reward is paid from platform yield, an unmodeled source (like trade-fee revenue),
// so redeeming credits principal + reward and never requires another user to be debited.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";
import { getSpotWallet } from "./trading-engine.js";
import { notify } from "./notifications.js";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Reward accrued on a stake by `now` (pure). Locked stakes stop accruing at unlock. */
export function accruedReward(
  principal: Decimal,
  aprBps: number,
  startAt: Date,
  lockDays: number,
  now: Date = new Date(),
): Decimal {
  let elapsedMs = now.getTime() - startAt.getTime();
  if (elapsedMs <= 0) return new D(0);
  if (lockDays > 0) elapsedMs = Math.min(elapsedMs, lockDays * 24 * 60 * 60 * 1000);
  const years = elapsedMs / YEAR_MS;
  return principal.times(new D(aprBps).dividedBy(10_000)).times(years);
}

export type StakeResult =
  | { ok: true; positionId: string; principal: string; unlockAt: string | null }
  | { ok: false; error: string };

/** Stake into a product: debits principal from the user's SPOT wallet, opens a position. */
export async function stake(
  prisma: PrismaClient,
  input: { userId: string; productId: string; amount: string | number },
): Promise<StakeResult> {
  const amount = new D(input.amount);
  if (amount.lessThanOrEqualTo(0)) return { ok: false, error: "Amount must be positive" };

  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.stakingProduct.findUnique({
        where: { id: input.productId },
        include: { asset: { select: { symbol: true } } },
      });
      if (!product || !product.isActive) return { ok: false as const, error: "Product unavailable" };
      if (amount.lessThan(product.minStake)) {
        return { ok: false as const, error: `Minimum stake is ${product.minStake.toString()} ${product.asset.symbol}` };
      }

      const wallet = await getSpotWallet(tx, input.userId, product.assetId);
      const available = new D(wallet.balance).minus(wallet.lockedBalance);
      if (available.lessThan(amount)) {
        return { ok: false as const, error: `Insufficient ${product.asset.symbol} balance` };
      }

      const startAt = new Date();
      const unlockAt =
        product.lockDays > 0
          ? new Date(startAt.getTime() + product.lockDays * 24 * 60 * 60 * 1000)
          : null;

      const position = await tx.stakePosition.create({
        data: {
          userId: input.userId,
          productId: product.id,
          assetId: product.assetId,
          principal: amount,
          aprBps: product.aprBps,
          lockDays: product.lockDays,
          startAt,
          unlockAt,
        },
      });

      const newBal = new D(wallet.balance).minus(amount);
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          userId: input.userId,
          assetId: product.assetId,
          type: "STAKE",
          status: "CONFIRMED",
          amount: amount.negated(),
          balanceAfter: newBal,
          referenceType: "StakePosition",
          referenceId: position.id,
          note: `stake ${product.name}`,
        },
      });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

      return {
        ok: true as const,
        positionId: position.id,
        principal: amount.toString(),
        unlockAt: unlockAt ? unlockAt.toISOString() : null,
      };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type RedeemResult =
  | { ok: true; principal: string; reward: string; total: string }
  | { ok: false; error: string };

/** Redeem a stake: returns principal + accrued reward to the SPOT wallet. Locked stakes can't
 *  be redeemed before their unlock time. */
export async function redeemStake(
  prisma: PrismaClient,
  input: { userId: string; positionId: string },
): Promise<RedeemResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const position = await tx.stakePosition.findUnique({
        where: { id: input.positionId },
        include: { product: { select: { name: true } } },
      });
      if (!position) return { ok: false as const, error: "Stake not found" };
      if (position.userId !== input.userId) return { ok: false as const, error: "Not your stake" };
      if (position.status !== "ACTIVE") return { ok: false as const, error: "Already redeemed" };

      const now = new Date();
      if (position.unlockAt && now < position.unlockAt) {
        return { ok: false as const, error: `Locked until ${position.unlockAt.toISOString()}` };
      }

      const principal = new D(position.principal);
      const reward = accruedReward(principal, position.aprBps, position.startAt, position.lockDays, now);

      const wallet = await getSpotWallet(tx, position.userId, position.assetId);
      let balance = new D(wallet.balance);

      // Return principal.
      balance = balance.plus(principal);
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id, userId: position.userId, assetId: position.assetId,
          type: "STAKE", status: "CONFIRMED", amount: principal, balanceAfter: balance,
          referenceType: "StakePosition", referenceId: position.id, note: `redeem ${position.product.name}`,
        },
      });
      // Pay reward.
      if (reward.greaterThan(0)) {
        balance = balance.plus(reward);
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id, userId: position.userId, assetId: position.assetId,
            type: "STAKING_REWARD", status: "CONFIRMED", amount: reward, balanceAfter: balance,
            referenceType: "StakePosition", referenceId: position.id, note: `staking reward ${position.product.name}`,
          },
        });
      }
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance } });

      await tx.stakePosition.update({
        where: { id: position.id },
        data: { status: "REDEEMED", rewardPaid: reward, redeemedAt: now },
      });

      await notify(tx, {
        userId: position.userId,
        type: "STAKING",
        title: "Stake redeemed",
        body: `You redeemed ${principal.toString()} + ${reward.toFixed(8)} reward from ${position.product.name}.`,
        referenceType: "StakePosition",
        referenceId: position.id,
      });

      return {
        ok: true as const,
        principal: principal.toString(),
        reward: reward.toString(),
        total: principal.plus(reward).toString(),
      };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
