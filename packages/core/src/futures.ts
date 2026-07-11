// Isolated-margin perpetual futures. Same money discipline as spot/convert: every balance
// change is one append-only LedgerEntry written in the SAME transaction; balance is the cache.
//
// Model (isolated margin, one position per open row):
//   • Collateral `margin` (quote asset, e.g. USDT) is moved OUT of the user's SPOT wallet on
//     open — it lives on the FuturesPosition row, not in a wallet. Size (base contracts) =
//     (margin × leverage) / entryPrice. Entry price is the current mark (Ticker.lastPrice).
//   • A taker fee (market.takerFeeBps, on notional) is charged on open and on close, exactly
//     like spot — platform revenue, an unmodeled sink (FEE ledger entries).
//   • Unrealized PnL at mark price m:  LONG (m − entry)·size,  SHORT (entry − m)·size.
//   • On close/liquidation the position is settled at the mark: the user's SPOT wallet is
//     credited  max(0, margin + uPnL − fundingAccrued) − closeFee  (floored at 0). Isolated
//     means the most a user can lose is their margin; deficit (bad debt) is the platform's.
//   • Funding: each interval the engine accrues  mark·size·rate  onto the position (LONG pays
//     when rate > 0), realized into the settlement figure at close. Simplified — a fixed
//     nominal rate, not premium-derived. See services/liquidation-engine.
//   • Liquidation (engine, exact): equity = margin + uPnL − fundingAccrued; liquidate when
//     equity ≤ maintenanceMargin (= mark·size·mmr). `liquidationPrice` on the row is a display
//     approximation; the engine always uses the exact equity check.
//
// Deferred (documented): cross margin, and advanced order types (OCO, trailing stop, iceberg,
// reduce-only) — these are order-management features layered on top of this risk core.

import { Prisma, type PrismaClient, type PositionSide } from "../generated/prisma/index.js";
import { getSpotWallet } from "./trading-engine.js";
import { notify } from "./notifications.js";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export const MAX_LEVERAGE = Number(process.env.FUTURES_MAX_LEVERAGE ?? 50);
export const MAINTENANCE_MARGIN_RATE = new D(process.env.FUTURES_MMR ?? "0.005"); // 0.5%
export const FUNDING_INTERVAL_MS = Number(process.env.FUNDING_INTERVAL_MS ?? 8 * 60 * 60 * 1000);
export const DEFAULT_FUNDING_RATE = new D(process.env.FUNDING_RATE ?? "0.0001"); // 0.01%/interval

// ── Pure helpers (framework-free, directly unit-tested) ──────────────────────

/** Unrealized PnL in quote asset for a position marked at `mark`. */
export function unrealizedPnl(
  side: PositionSide,
  entryPrice: Decimal,
  mark: Decimal,
  size: Decimal,
): Decimal {
  const diff = side === "LONG" ? mark.minus(entryPrice) : entryPrice.minus(mark);
  return diff.times(size);
}

/** Account equity backing an isolated position at `mark`, net of accrued funding. */
export function positionEquity(
  side: PositionSide,
  entryPrice: Decimal,
  mark: Decimal,
  size: Decimal,
  margin: Decimal,
  fundingAccrued: Decimal,
): Decimal {
  return margin.plus(unrealizedPnl(side, entryPrice, mark, size)).minus(fundingAccrued);
}

/** True when the position's equity has fallen to/below maintenance margin at `mark`. */
export function isLiquidatable(
  side: PositionSide,
  entryPrice: Decimal,
  mark: Decimal,
  size: Decimal,
  margin: Decimal,
  fundingAccrued: Decimal,
  mmr: Decimal = MAINTENANCE_MARGIN_RATE,
): boolean {
  const equity = positionEquity(side, entryPrice, mark, size, margin, fundingAccrued);
  const maintenance = mark.times(size).times(mmr);
  return equity.lessThanOrEqualTo(maintenance);
}

/** Display-only liquidation price (simplified): entry × (1 ∓ 1/lev ± mmr). */
export function liquidationPriceFor(
  side: PositionSide,
  entryPrice: Decimal,
  leverage: number,
  mmr: Decimal = MAINTENANCE_MARGIN_RATE,
): Decimal {
  const inv = new D(1).dividedBy(leverage);
  const factor =
    side === "LONG" ? new D(1).minus(inv).plus(mmr) : new D(1).plus(inv).minus(mmr);
  const price = entryPrice.times(factor);
  return price.lessThan(0) ? new D(0) : price;
}

// ── Transactional money operations ───────────────────────────────────────────

export interface OpenPositionInput {
  userId: string;
  marketSymbol: string;
  side: PositionSide;
  leverage: number;
  margin: string | number; // collateral in quote asset
}

export type OpenPositionResult =
  | { ok: true; positionId: string; size: string; entryPrice: string; liquidationPrice: string; fee: string }
  | { ok: false; error: string };

export async function openPosition(
  prisma: PrismaClient,
  input: OpenPositionInput,
): Promise<OpenPositionResult> {
  const margin = new D(input.margin);
  if (!Number.isInteger(input.leverage) || input.leverage < 1 || input.leverage > MAX_LEVERAGE) {
    return { ok: false, error: `Leverage must be a whole number between 1 and ${MAX_LEVERAGE}` };
  }
  if (margin.lessThanOrEqualTo(0)) return { ok: false, error: "Margin must be positive" };
  if (input.side !== "LONG" && input.side !== "SHORT") {
    return { ok: false, error: "Side must be LONG or SHORT" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({
        where: { symbol: input.marketSymbol },
        include: { quoteAsset: true, ticker: true },
      });
      if (!market) return { ok: false as const, error: "Unknown market" };
      if (!market.ticker) return { ok: false as const, error: "No live price for this market" };

      const entryPrice = new D(market.ticker.lastPrice);
      if (entryPrice.lessThanOrEqualTo(0)) return { ok: false as const, error: "Invalid mark price" };

      const notional = margin.times(input.leverage);
      const size = notional.dividedBy(entryPrice);
      const openFee = notional.times(market.takerFeeBps).dividedBy(10_000);
      const totalDebit = margin.plus(openFee);

      const wallet = await getSpotWallet(tx, input.userId, market.quoteAssetId);
      const available = new D(wallet.balance).minus(wallet.lockedBalance);
      if (available.lessThan(totalDebit)) {
        return {
          ok: false as const,
          error: `Insufficient ${market.quoteAsset.symbol}: need ${totalDebit.toFixed(2)} (margin + fee)`,
        };
      }

      const liquidationPrice = liquidationPriceFor(input.side, entryPrice, input.leverage);

      const position = await tx.futuresPosition.create({
        data: {
          userId: input.userId,
          marketId: market.id,
          side: input.side,
          leverage: input.leverage,
          size,
          entryPrice,
          margin,
          liquidationPrice,
          status: "OPEN",
        },
      });

      // Debit margin (collateral leaves the wallet, held by the position).
      const afterMargin = new D(wallet.balance).minus(margin);
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          userId: input.userId,
          assetId: market.quoteAssetId,
          type: "FUTURES_MARGIN",
          status: "CONFIRMED",
          amount: margin.negated(),
          balanceAfter: afterMargin,
          referenceType: "FuturesPosition",
          referenceId: position.id,
          note: `open ${input.side} ${input.leverage}x ${market.symbol}`,
        },
      });
      // Debit taker fee (platform revenue).
      const afterFee = afterMargin.minus(openFee);
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          userId: input.userId,
          assetId: market.quoteAssetId,
          type: "FEE",
          status: "CONFIRMED",
          amount: openFee.negated(),
          balanceAfter: afterFee,
          referenceType: "FuturesPosition",
          referenceId: position.id,
          note: `open fee ${market.symbol}`,
        },
      });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: afterFee } });

      return {
        ok: true as const,
        positionId: position.id,
        size: size.toString(),
        entryPrice: entryPrice.toString(),
        liquidationPrice: liquidationPrice.toString(),
        fee: openFee.toString(),
      };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type SettleResult =
  | { ok: true; returned: string; realizedPnl: string; fee: string; liquidated: boolean }
  | { ok: false; error: string };

/**
 * Settle an OPEN position at `markPrice`, crediting the user's SPOT wallet with
 * max(0, margin + uPnL − fundingAccrued) − closeFee. Shared by user close and engine
 * liquidation; `liquidated` only changes the recorded status + ledger entry type.
 */
async function settleAtMark(
  tx: Prisma.TransactionClient,
  positionId: string,
  markPrice: Decimal,
  liquidated: boolean,
): Promise<SettleResult> {
  const position = await tx.futuresPosition.findUnique({
    where: { id: positionId },
    include: { market: { select: { quoteAssetId: true, takerFeeBps: true, symbol: true } } },
  });
  if (!position) return { ok: false, error: "Position not found" };
  if (position.status !== "OPEN") return { ok: false, error: "Position is not open" };

  const size = new D(position.size);
  const margin = new D(position.margin);
  const uPnl = unrealizedPnl(position.side, new D(position.entryPrice), markPrice, size);
  const gross = D.max(new D(0), margin.plus(uPnl).minus(position.fundingAccrued));
  const closeFee = D.min(gross, markPrice.times(size).times(position.market.takerFeeBps).dividedBy(10_000));
  const netReturn = gross.minus(closeFee);
  const realizedPnl = netReturn.minus(margin);

  await tx.futuresPosition.update({
    where: { id: position.id },
    data: {
      status: liquidated ? "LIQUIDATED" : "CLOSED",
      closePrice: markPrice,
      realizedPnl,
      closedAt: new Date(),
    },
  });

  const wallet = await getSpotWallet(tx, position.userId, position.market.quoteAssetId);
  let balance = new D(wallet.balance);

  if (gross.greaterThan(0)) {
    balance = balance.plus(gross);
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        userId: position.userId,
        assetId: position.market.quoteAssetId,
        type: liquidated ? "LIQUIDATION" : "FUTURES_PNL",
        status: "CONFIRMED",
        amount: gross,
        balanceAfter: balance,
        referenceType: "FuturesPosition",
        referenceId: position.id,
        note: `${liquidated ? "liquidate" : "close"} ${position.side} ${position.market.symbol} @ ${markPrice.toFixed(2)}`,
      },
    });
  }
  if (closeFee.greaterThan(0)) {
    balance = balance.minus(closeFee);
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        userId: position.userId,
        assetId: position.market.quoteAssetId,
        type: "FEE",
        status: "CONFIRMED",
        amount: closeFee.negated(),
        balanceAfter: balance,
        referenceType: "FuturesPosition",
        referenceId: position.id,
        note: `close fee ${position.market.symbol}`,
      },
    });
  }
  if (gross.greaterThan(0) || closeFee.greaterThan(0)) {
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance } });
  }

  if (liquidated) {
    // In-tx: the liquidation engine is the only place this fires, no other chokepoint.
    await notify(tx, {
      userId: position.userId,
      type: "LIQUIDATION",
      title: "Position liquidated",
      body: `Your ${position.side} ${position.market.symbol} position was liquidated at ${markPrice.toFixed(2)}. Margin lost: ${margin.toFixed(2)}.`,
      referenceType: "FuturesPosition",
      referenceId: position.id,
    });
  }

  return {
    ok: true,
    returned: netReturn.toString(),
    realizedPnl: realizedPnl.toString(),
    fee: closeFee.toString(),
    liquidated,
  };
}

/** User-initiated close at the current mark (Ticker). Guards ownership. */
export async function closePosition(
  prisma: PrismaClient,
  input: { userId: string; positionId: string },
): Promise<SettleResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const position = await tx.futuresPosition.findUnique({
        where: { id: input.positionId },
        include: { market: { include: { ticker: true } } },
      });
      if (!position) return { ok: false as const, error: "Position not found" };
      if (position.userId !== input.userId) return { ok: false as const, error: "Not your position" };
      if (position.status !== "OPEN") return { ok: false as const, error: "Position is not open" };
      if (!position.market.ticker) return { ok: false as const, error: "No live price to close at" };
      return settleAtMark(tx, position.id, new D(position.market.ticker.lastPrice), false);
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Engine-initiated force-close at `markPrice`. */
export async function liquidatePosition(
  prisma: PrismaClient,
  input: { positionId: string; markPrice: string | number },
): Promise<SettleResult> {
  try {
    return await prisma.$transaction((tx) =>
      settleAtMark(tx, input.positionId, new D(input.markPrice), true),
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Accrue one funding interval onto an open position (no wallet movement — realized at close).
 * funding = mark·size·rate; LONG pays (fundingAccrued +=) when rate > 0, SHORT receives.
 */
export async function accrueFunding(
  prisma: PrismaClient,
  input: { positionId: string; markPrice: string | number; rate?: string | number },
): Promise<{ ok: boolean; fundingAccrued?: string; error?: string }> {
  try {
    const rate = new D(input.rate ?? DEFAULT_FUNDING_RATE);
    const mark = new D(input.markPrice);
    const position = await prisma.futuresPosition.findUnique({ where: { id: input.positionId } });
    if (!position || position.status !== "OPEN") return { ok: false, error: "Position not open" };
    const funding = mark.times(position.size).times(rate);
    const delta = position.side === "LONG" ? funding : funding.negated();
    const updated = await prisma.futuresPosition.update({
      where: { id: position.id },
      data: { fundingAccrued: new D(position.fundingAccrued).plus(delta) },
    });
    return { ok: true, fundingAccrued: updated.fundingAccrued.toString() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
