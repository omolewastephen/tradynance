// Pure spot-matching domain logic — no DB, no framework. Unit-tested in
// scripts/trading-test.ts. The transactional settlement that turns these fills into ledger
// entries + balance moves lives in trading-engine.ts.
//
// Model: price-time priority. An incoming (taker) order crosses the book against resting
// (maker) orders on the opposite side, best price first. LIMIT orders only match at prices
// at least as good as their limit; MARKET orders match any price. Remainder handling per TIF
// is decided by the caller (rest on book for GTC LIMIT, else cancel).

import { Prisma } from "../generated/prisma/index.js";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export type Side = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type TimeInForce = "GTC" | "IOC" | "FOK";

export interface RestingOrder {
  id: string;
  userId: string;
  side: Side;
  price: Decimal; // resting orders always have a price
  /** Remaining base quantity available to fill (quantity − filledQuantity). */
  remaining: Decimal;
}

export interface IncomingOrder {
  side: Side;
  type: OrderType;
  timeInForce: TimeInForce;
  /** Limit price (undefined for MARKET). */
  price?: Decimal;
  /** Base quantity requested. */
  quantity: Decimal;
}

export interface Fill {
  makerOrderId: string;
  makerUserId: string;
  price: Decimal; // execution price = maker's resting price
  quantity: Decimal; // base quantity filled
}

export interface MatchResult {
  fills: Fill[];
  filledQty: Decimal; // total base filled
  quoteSpent: Decimal; // Σ price×qty across fills
  /** true if the whole incoming quantity was filled. */
  fullyFilled: boolean;
}

function crosses(incoming: IncomingOrder, restingPrice: Decimal): boolean {
  if (incoming.type === "MARKET") return true;
  const limit = incoming.price!;
  return incoming.side === "BUY"
    ? restingPrice.lessThanOrEqualTo(limit) // buy: fill at or below my limit
    : restingPrice.greaterThanOrEqualTo(limit); // sell: fill at or above my limit
}

/**
 * Match an incoming order against resting orders on the OPPOSITE side.
 * `resting` MUST already be sorted best-price-first for the taker:
 *   - incoming BUY  → resting SELLs ascending by price (cheapest first)
 *   - incoming SELL → resting BUYs  descending by price (highest first)
 * with older orders before newer at equal price (time priority).
 *
 * Pure: returns the fills; does not mutate inputs.
 */
export function matchOrder(
  incoming: IncomingOrder,
  resting: RestingOrder[],
): MatchResult {
  const fills: Fill[] = [];
  let remaining = incoming.quantity;
  let quoteSpent = new D(0);

  for (const maker of resting) {
    if (remaining.lessThanOrEqualTo(0)) break;
    if (!crosses(incoming, maker.price)) break; // sorted, so nothing further can cross
    const qty = Prisma.Decimal.min(remaining, maker.remaining);
    if (qty.lessThanOrEqualTo(0)) continue;
    fills.push({
      makerOrderId: maker.id,
      makerUserId: maker.userId,
      price: maker.price,
      quantity: qty,
    });
    quoteSpent = quoteSpent.plus(qty.times(maker.price));
    remaining = remaining.minus(qty);
  }

  const filledQty = incoming.quantity.minus(remaining);
  return {
    fills,
    filledQty,
    quoteSpent,
    fullyFilled: remaining.lessThanOrEqualTo(0),
  };
}

/** Fee = notional × bps / 10_000. */
export function feeFor(notional: Decimal, bps: number): Decimal {
  return notional.times(bps).dividedBy(10_000);
}

export { D as Decimal };
