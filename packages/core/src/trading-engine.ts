// Spot order placement + settlement. Turns the pure matching in trading.ts into real money
// movement, holding the same invariant as deposits/withdrawals: every balance change is one
// append-only LedgerEntry written in the SAME transaction, balance is the cache.
//
// Trading balances live in a per-(user,asset) SPOT wallet (network = "SPOT"), separate from
// the network-specific deposit wallets. Funding a SPOT wallet from a deposit wallet (an
// internal transfer) is deferred — for now SPOT is funded via admin manual-credit / the
// market-maker seed. (This funding↔spot split mirrors Binance's Funding vs Spot wallets.)
//
// Fee model: taker and maker fees are charged in the QUOTE asset. A BUY pays notional+fee; a
// SELL receives notional−fee. A resting BUY locks price×qty×(1+makerBps); a resting SELL locks
// qty base — exactly what settlement consumes on fill, so locks never leave dust.
//
// Concurrency: runs at Serializable isolation so two crossing orders can't double-fill the
// same resting liquidity (one transaction will abort and can be retried by the caller).

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";
import {
  matchOrder,
  feeFor,
  type Side,
  type OrderType,
  type TimeInForce,
  type RestingOrder,
} from "./trading.js";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
export const SPOT_NETWORK = "SPOT";

export interface PlaceOrderInput {
  userId: string;
  marketSymbol: string;
  side: Side;
  type: OrderType;
  timeInForce: TimeInForce;
  price?: string | number; // required for LIMIT
  quantity: string | number; // base quantity
  // Optional VIP-discounted taker fee (bps). Computed by the action from the user's tier; when
  // absent the market's base rate is used. See packages/core/src/vip.ts.
  takerFeeBpsOverride?: number;
}

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      status: string;
      filledQty: string;
      avgPrice: string | null;
      resting: boolean;
    }
  | { ok: false; error: string };

/** Get-or-create a user's SPOT (trading) wallet for an asset, inside a transaction. */
export async function getSpotWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  assetId: string,
) {
  const existing = await tx.wallet.findFirst({
    where: { userId, assetId, network: SPOT_NETWORK },
  });
  if (existing) return existing;
  return tx.wallet.create({ data: { userId, assetId, network: SPOT_NETWORK } });
}

export async function placeOrder(
  prisma: PrismaClient,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const qty = new D(input.quantity);
  if (qty.lessThanOrEqualTo(0)) return { ok: false, error: "Quantity must be positive" };
  if (input.type === "LIMIT" && input.price === undefined) {
    return { ok: false, error: "Limit orders need a price" };
  }
  const limitPrice = input.type === "LIMIT" ? new D(input.price!) : undefined;
  if (limitPrice && limitPrice.lessThanOrEqualTo(0)) {
    return { ok: false, error: "Price must be positive" };
  }

  try {
    return await prisma.$transaction(
      async (tx) => runPlaceOrder(tx, input, qty, limitPrice),
      { isolationLevel: "Serializable", timeout: 15_000 },
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function runPlaceOrder(
  tx: Prisma.TransactionClient,
  input: PlaceOrderInput,
  qty: Decimal,
  limitPrice: Decimal | undefined,
): Promise<PlaceOrderResult> {
  const market = await tx.market.findUnique({
    where: { symbol: input.marketSymbol },
    include: { baseAsset: true, quoteAsset: true },
  });
  if (!market || !market.isActive) return { ok: false, error: "Unknown or inactive market" };

  // VIP: the action may pass a discounted taker rate; makers (system liquidity) pay base.
  const takerBps = input.takerFeeBpsOverride ?? market.takerFeeBps;
  const makerBps = market.makerFeeBps;

  // Resting orders on the opposite side, best price first for the taker.
  const oppSide: Side = input.side === "BUY" ? "SELL" : "BUY";
  const restingRows = await tx.order.findMany({
    where: { marketId: market.id, side: oppSide, status: { in: ["OPEN", "PARTIALLY_FILLED"] } },
    orderBy: [{ price: input.side === "BUY" ? "asc" : "desc" }, { createdAt: "asc" }],
  });
  const resting: RestingOrder[] = restingRows.map((o) => ({
    id: o.id,
    userId: o.userId,
    side: o.side as Side,
    price: new D(o.price!),
    remaining: new D(o.quantity).minus(o.filledQuantity),
  }));

  const match = matchOrder(
    {
      side: input.side,
      type: input.type,
      timeInForce: input.timeInForce,
      price: limitPrice,
      quantity: qty,
    },
    resting,
  );

  // FOK: all-or-nothing.
  if (input.timeInForce === "FOK" && !match.fullyFilled) {
    return { ok: false, error: "Fill-or-kill order could not be fully filled" };
  }
  // MARKET with no liquidity.
  if (input.type === "MARKET" && match.fills.length === 0) {
    return { ok: false, error: "No liquidity to fill a market order" };
  }

  const remainder = qty.minus(match.filledQty);
  const willRest =
    input.type === "LIMIT" && input.timeInForce === "GTC" && remainder.greaterThan(0);

  // ── in-memory wallet ledger (balanceAfter snapshots must be sequential) ──
  const cache = new Map<string, { id: string; assetId: string; balance: Decimal; locked: Decimal }>();
  const ledger: Prisma.LedgerEntryCreateManyInput[] = [];
  const walletKey = (userId: string, assetId: string) => `${userId}:${assetId}`;
  const walletByUserAsset = new Map<string, string>(); // key -> walletId

  async function wallet(userId: string, assetId: string) {
    const key = walletKey(userId, assetId);
    const id = walletByUserAsset.get(key);
    if (id) return cache.get(id)!;
    const w = await getSpotWallet(tx, userId, assetId);
    const entry = { id: w.id, assetId, balance: new D(w.balance), locked: new D(w.lockedBalance) };
    cache.set(w.id, entry);
    walletByUserAsset.set(key, w.id);
    return entry;
  }

  function apply(
    w: { id: string; assetId: string; balance: Decimal; locked: Decimal },
    userId: string,
    deltaBalance: Decimal,
    deltaLocked: Decimal,
    type: "TRADE_FILL" | "FEE",
    refId: string,
    note?: string,
  ) {
    w.balance = w.balance.plus(deltaBalance);
    w.locked = w.locked.plus(deltaLocked);
    if (!deltaBalance.isZero()) {
      ledger.push({
        walletId: w.id,
        userId,
        assetId: w.assetId,
        type,
        status: "CONFIRMED",
        amount: deltaBalance,
        balanceAfter: w.balance,
        referenceType: "Trade",
        referenceId: refId,
        note: note ?? null,
      });
    }
    if (w.balance.lessThan(0) || w.locked.lessThan(0)) {
      throw new Error("Balance/lock went negative — insufficient funds");
    }
  }

  const takerBase = await wallet(input.userId, market.baseAssetId);
  const takerQuote = await wallet(input.userId, market.quoteAssetId);

  // ── funds sufficiency check (against available = balance − locked) ──
  if (input.side === "BUY") {
    const takerFeeTotal = feeFor(match.quoteSpent, takerBps);
    let needQuote = match.quoteSpent.plus(takerFeeTotal);
    if (willRest) {
      needQuote = needQuote.plus(
        remainder.times(limitPrice!).times(new D(1).plus(new D(makerBps).dividedBy(10_000))),
      );
    }
    const availQuote = takerQuote.balance.minus(takerQuote.locked);
    if (availQuote.lessThan(needQuote)) {
      return { ok: false, error: "Insufficient quote (USDT) balance" };
    }
  } else {
    const needBase = willRest ? qty : match.filledQty;
    const availBase = takerBase.balance.minus(takerBase.locked);
    if (availBase.lessThan(needBase)) {
      return { ok: false, error: "Insufficient base balance" };
    }
  }

  // Create the incoming order row first (fills reference it).
  const order = await tx.order.create({
    data: {
      userId: input.userId,
      marketId: market.id,
      side: input.side,
      type: input.type,
      timeInForce: input.timeInForce,
      price: limitPrice ?? null,
      quantity: qty,
      status: "OPEN",
    },
  });

  // ── settle each fill ──
  for (const fill of match.fills) {
    const notional = fill.quantity.times(fill.price);
    const takerFee = feeFor(notional, takerBps);
    const makerFee = feeFor(notional, makerBps);

    const makerBase = await wallet(fill.makerUserId, market.baseAssetId);
    const makerQuote = await wallet(fill.makerUserId, market.quoteAssetId);

    if (input.side === "BUY") {
      // taker buys base, pays quote+fee; maker (resting SELL) delivers locked base, gets quote−fee
      apply(takerQuote, input.userId, notional.negated(), new D(0), "TRADE_FILL", fill.makerOrderId, "buy: pay quote");
      apply(takerQuote, input.userId, takerFee.negated(), new D(0), "FEE", fill.makerOrderId, "taker fee");
      apply(takerBase, input.userId, fill.quantity, new D(0), "TRADE_FILL", fill.makerOrderId, "buy: receive base");
      apply(makerBase, fill.makerUserId, fill.quantity.negated(), fill.quantity.negated(), "TRADE_FILL", fill.makerOrderId, "sell: deliver base");
      apply(makerQuote, fill.makerUserId, notional, new D(0), "TRADE_FILL", fill.makerOrderId, "sell: receive quote");
      apply(makerQuote, fill.makerUserId, makerFee.negated(), new D(0), "FEE", fill.makerOrderId, "maker fee");
    } else {
      // taker sells base, gets quote−fee; maker (resting BUY) had quote locked, gets base
      apply(takerBase, input.userId, fill.quantity.negated(), new D(0), "TRADE_FILL", fill.makerOrderId, "sell: deliver base");
      apply(takerQuote, input.userId, notional, new D(0), "TRADE_FILL", fill.makerOrderId, "sell: receive quote");
      apply(takerQuote, input.userId, takerFee.negated(), new D(0), "FEE", fill.makerOrderId, "taker fee");
      const makerCost = notional.plus(makerFee);
      apply(makerQuote, fill.makerUserId, makerCost.negated(), makerCost.negated(), "TRADE_FILL", fill.makerOrderId, "buy: pay quote");
      apply(makerBase, fill.makerUserId, fill.quantity, new D(0), "TRADE_FILL", fill.makerOrderId, "buy: receive base");
    }

    // Trade row + maker order fill update
    const makerOrder = restingRows.find((o) => o.id === fill.makerOrderId)!;
    const makerFilled = new D(makerOrder.filledQuantity).plus(fill.quantity);
    const makerCumQuote = new D(makerOrder.cumulativeQuote).plus(notional);
    await tx.order.update({
      where: { id: makerOrder.id },
      data: {
        filledQuantity: makerFilled,
        cumulativeQuote: makerCumQuote,
        avgFillPrice: makerCumQuote.dividedBy(makerFilled),
        status: makerFilled.greaterThanOrEqualTo(makerOrder.quantity) ? "FILLED" : "PARTIALLY_FILLED",
      },
    });
    await tx.trade.create({
      data: {
        marketId: market.id,
        buyOrderId: input.side === "BUY" ? order.id : makerOrder.id,
        sellOrderId: input.side === "SELL" ? order.id : makerOrder.id,
        price: fill.price,
        quantity: fill.quantity,
        buyerFee: input.side === "BUY" ? takerFee : makerFee,
        sellerFee: input.side === "SELL" ? takerFee : makerFee,
        takerSide: input.side,
      },
    });
    // maker's resting lock is consumed by the apply() calls above (deltaLocked negatives).
  }

  // ── rest or finalize the incoming order ──
  let finalStatus: string;
  if (willRest) {
    // Lock the remainder's funds so the resting order is covered.
    if (input.side === "BUY") {
      const lockQuote = remainder
        .times(limitPrice!)
        .times(new D(1).plus(new D(makerBps).dividedBy(10_000)));
      apply(takerQuote, input.userId, new D(0), lockQuote, "TRADE_FILL", order.id, "rest: lock quote");
    } else {
      apply(takerBase, input.userId, new D(0), remainder, "TRADE_FILL", order.id, "rest: lock base");
    }
    finalStatus = match.filledQty.greaterThan(0) ? "PARTIALLY_FILLED" : "OPEN";
  } else {
    finalStatus = match.fullyFilled ? "FILLED" : "CANCELLED"; // IOC/MARKET leftover cancels
  }

  const avg = match.filledQty.greaterThan(0)
    ? match.quoteSpent.dividedBy(match.filledQty)
    : null;
  await tx.order.update({
    where: { id: order.id },
    data: {
      filledQuantity: match.filledQty,
      cumulativeQuote: match.quoteSpent,
      avgFillPrice: avg,
      status: finalStatus as never,
    },
  });

  // ── flush wallet balances + ledger entries ──
  for (const w of cache.values()) {
    await tx.wallet.update({
      where: { id: w.id },
      data: { balance: w.balance, lockedBalance: w.locked },
    });
  }
  if (ledger.length) await tx.ledgerEntry.createMany({ data: ledger });

  return {
    ok: true,
    orderId: order.id,
    status: finalStatus,
    filledQty: match.filledQty.toString(),
    avgPrice: avg ? avg.toString() : null,
    resting: willRest,
  };
}

/** Cancel a resting order and release its locked funds. Idempotent on terminal orders. */
export async function cancelOrder(
  prisma: PrismaClient,
  input: { orderId: string; userId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { market: true },
      });
      if (!order || order.userId !== input.userId) return { ok: false as const, error: "Order not found" };
      if (!["OPEN", "PARTIALLY_FILLED"].includes(order.status)) {
        return { ok: false as const, error: "Order is not open" };
      }
      const remainder = new D(order.quantity).minus(order.filledQuantity);
      const makerBps = order.market.makerFeeBps;

      if (order.side === "BUY") {
        const lock = remainder
          .times(new D(order.price!))
          .times(new D(1).plus(new D(makerBps).dividedBy(10_000)));
        await releaseLock(tx, order.userId, order.market.quoteAssetId, lock);
      } else {
        await releaseLock(tx, order.userId, order.market.baseAssetId, remainder);
      }
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function releaseLock(
  tx: Prisma.TransactionClient,
  userId: string,
  assetId: string,
  amount: Decimal,
) {
  const w = await getSpotWallet(tx, userId, assetId);
  const newLocked = Prisma.Decimal.max(new D(w.lockedBalance).minus(amount), 0);
  await tx.wallet.update({ where: { id: w.id }, data: { lockedBalance: newLocked } });
}
