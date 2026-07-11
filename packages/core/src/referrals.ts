// Referral commissions. A referrer earns a rebate on the trading fees their referees pay.
// Rather than surgically inject payouts into the conservation-tested spot/futures settlement
// (the hot money path), commissions are settled from the FEE ledger entries those trades
// already write: each FEE entry from a referred user yields one ReferralCommission, keyed by
// the fee entry's id (`ledgerEntryId` UNIQUE) so settlement is fully idempotent — safe to call
// repeatedly (from the trade action, and/or a periodic job later).
//
// The rebate is credited to the referrer's SPOT wallet in the fee's asset via a
// REFERRAL_COMMISSION ledger entry. It comes from platform fee revenue (an unmodeled sink,
// like the fees themselves), so it's a new credit to the referrer and never touches the referee.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";
import { getSpotWallet } from "./trading-engine.js";
import { notify } from "./notifications.js";

const D = Prisma.Decimal;

export const REFERRAL_COMMISSION_BPS = Number(process.env.REFERRAL_COMMISSION_BPS ?? 2000); // 20%

export interface SettleReferralResult {
  settled: number; // number of fee entries turned into commissions this call
  total: string; // total commission credited this call (may span assets; informational)
}

/**
 * Settle any not-yet-commissioned trading fees a user has paid, crediting their referrer.
 * No-op if the user has no referrer. Idempotent (unique on the source fee entry).
 */
export async function settleReferralCommissionsForUser(
  prisma: PrismaClient,
  refereeId: string,
): Promise<SettleReferralResult> {
  const referee = await prisma.user.findUnique({
    where: { id: refereeId },
    select: { referredById: true },
  });
  if (!referee?.referredById) return { settled: 0, total: "0" };
  const referrerId = referee.referredById;

  const feeEntries = await prisma.ledgerEntry.findMany({
    where: { userId: refereeId, type: "FEE" },
    select: { id: true, assetId: true, amount: true },
  });
  if (feeEntries.length === 0) return { settled: 0, total: "0" };

  const existing = await prisma.referralCommission.findMany({
    where: { ledgerEntryId: { in: feeEntries.map((e) => e.id) } },
    select: { ledgerEntryId: true },
  });
  const done = new Set(existing.map((e) => e.ledgerEntryId));
  const pending = feeEntries.filter((e) => !done.has(e.id));

  const rate = new D(REFERRAL_COMMISSION_BPS).dividedBy(10_000);
  let settled = 0;
  let total = new D(0);

  for (const fee of pending) {
    const feeAbs = new D(fee.amount).abs();
    const commission = feeAbs.times(rate);
    if (commission.lessThanOrEqualTo(0)) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const wallet = await getSpotWallet(tx, referrerId, fee.assetId);
        const newBal = new D(wallet.balance).plus(commission);
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            userId: referrerId,
            assetId: fee.assetId,
            type: "REFERRAL_COMMISSION",
            status: "CONFIRMED",
            amount: commission,
            balanceAfter: newBal,
            referenceType: "LedgerEntry",
            referenceId: fee.id,
            note: `referral rebate (${REFERRAL_COMMISSION_BPS / 100}% of referee fee)`,
          },
        });
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
        await tx.referralCommission.create({
          data: {
            referrerId,
            refereeId,
            ledgerEntryId: fee.id,
            assetId: fee.assetId,
            feeAmount: feeAbs,
            rateBps: REFERRAL_COMMISSION_BPS,
            commissionAmount: commission,
          },
        });
      });
      settled++;
      total = total.plus(commission);
    } catch (e) {
      // Unique violation on ledgerEntryId = another call settled it first; skip.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }

  if (settled > 0) {
    await notify(prisma, {
      userId: referrerId,
      type: "REFERRAL",
      title: "Referral commission earned",
      body: `You earned referral rebates from ${settled} trade${settled > 1 ? "s" : ""} by your referrals.`,
    });
  }

  return { settled, total: total.toString() };
}
