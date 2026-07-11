// Instant asset conversion (swap). Same money discipline as deposits/withdrawals/trades:
// debit the from-asset and credit the to-asset in ONE transaction, each a CONVERSION ledger
// entry, balance is the cache. Prices come from the Ticker cache (server-authoritative, so a
// stale client quote can't be exploited). The platform keeps a spread — the user receives
// slightly less than mid-market, mirroring Binance/Coinbase Convert.
//
// Operates on SPOT wallets (like trading). toAmount = fromAmount × (priceFrom/priceTo) ×
// (1 − spread). Value out (USD) = value in × (1 − spread); the spread is platform revenue
// (unmodeled, like trade fees) so a user's total USD value drops by exactly the spread.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";
import { getSpotWallet, SPOT_NETWORK } from "./trading-engine.js";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export const CONVERT_SPREAD_BPS = Number(process.env.CONVERT_SPREAD_BPS ?? 30); // 0.30%

export interface ConvertQuote {
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  rate: string; // effective toAmount/fromAmount, net of spread
  spreadBps: number;
}

/** USD price per asset symbol from the latest tickers (stables pinned to 1). */
async function priceMap(tx: Prisma.TransactionClient): Promise<Map<string, Decimal>> {
  const markets = await tx.market.findMany({
    where: { ticker: { isNot: null } },
    select: { baseAsset: { select: { symbol: true } }, ticker: { select: { lastPrice: true } } },
  });
  const m = new Map<string, Decimal>([
    ["USDT", new D(1)],
    ["USDC", new D(1)],
  ]);
  for (const mk of markets) if (mk.ticker) m.set(mk.baseAsset.symbol, new D(mk.ticker.lastPrice));
  return m;
}

function computeToAmount(
  fromAmount: Decimal,
  priceFrom: Decimal,
  priceTo: Decimal,
): { toAmount: Decimal; rate: Decimal } {
  const spreadFactor = new D(1).minus(new D(CONVERT_SPREAD_BPS).dividedBy(10_000));
  const rate = priceFrom.dividedBy(priceTo).times(spreadFactor);
  return { toAmount: fromAmount.times(rate), rate };
}

export type ConvertResult =
  | { ok: true; toAmount: string; rate: string }
  | { ok: false; error: string };

/**
 * Execute a conversion atomically. Re-prices server-side, so the client quote is only an
 * estimate — the recorded rate is whatever the server computes at execution time.
 */
export async function convert(
  prisma: PrismaClient,
  input: { userId: string; fromSymbol: string; toSymbol: string; fromAmount: string | number },
): Promise<ConvertResult> {
  const fromAmount = new D(input.fromAmount);
  if (input.fromSymbol === input.toSymbol) {
    return { ok: false, error: "Choose two different assets" };
  }
  if (fromAmount.lessThanOrEqualTo(0)) return { ok: false, error: "Amount must be positive" };

  try {
    return await prisma.$transaction(async (tx) => {
      const [fromAsset, toAsset] = await Promise.all([
        tx.asset.findUnique({ where: { symbol: input.fromSymbol } }),
        tx.asset.findUnique({ where: { symbol: input.toSymbol } }),
      ]);
      if (!fromAsset || !toAsset) return { ok: false as const, error: "Unknown asset" };

      const prices = await priceMap(tx);
      const priceFrom = prices.get(input.fromSymbol);
      const priceTo = prices.get(input.toSymbol);
      if (!priceFrom || !priceTo) {
        return { ok: false as const, error: "No live price for one of these assets" };
      }

      const { toAmount, rate } = computeToAmount(fromAmount, priceFrom, priceTo);

      const fromWallet = await getSpotWallet(tx, input.userId, fromAsset.id);
      const available = new D(fromWallet.balance).minus(fromWallet.lockedBalance);
      if (available.lessThan(fromAmount)) {
        return { ok: false as const, error: `Insufficient ${input.fromSymbol} balance` };
      }
      const toWallet = await getSpotWallet(tx, input.userId, toAsset.id);

      const conversion = await tx.conversion.create({
        data: {
          userId: input.userId,
          fromAssetId: fromAsset.id,
          toAssetId: toAsset.id,
          fromAmount,
          toAmount,
          rate,
        },
      });

      // Debit from-asset.
      const newFrom = new D(fromWallet.balance).minus(fromAmount);
      await tx.ledgerEntry.create({
        data: {
          walletId: fromWallet.id,
          userId: input.userId,
          assetId: fromAsset.id,
          type: "CONVERSION",
          status: "CONFIRMED",
          amount: fromAmount.negated(),
          balanceAfter: newFrom,
          referenceType: "Conversion",
          referenceId: conversion.id,
          note: `convert to ${input.toSymbol}`,
        },
      });
      await tx.wallet.update({ where: { id: fromWallet.id }, data: { balance: newFrom } });

      // Credit to-asset.
      const newTo = new D(toWallet.balance).plus(toAmount);
      await tx.ledgerEntry.create({
        data: {
          walletId: toWallet.id,
          userId: input.userId,
          assetId: toAsset.id,
          type: "CONVERSION",
          status: "CONFIRMED",
          amount: toAmount,
          balanceAfter: newTo,
          referenceType: "Conversion",
          referenceId: conversion.id,
          note: `convert from ${input.fromSymbol}`,
        },
      });
      await tx.wallet.update({ where: { id: toWallet.id }, data: { balance: newTo } });

      return { ok: true as const, toAmount: toAmount.toString(), rate: rate.toString() };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
