// Tradynance market-maker — standalone liquidity service. Keeps a ladder of resting limit
// orders around each market's live mid-price (from the Ticker cache) on behalf of a system
// MM user, so the order book looks real and user orders have something to fill against.
//
// It places orders through the SAME placeOrder path users do (correct locking + settlement),
// so when a user trade consumes an MM level, the MM's balances/lock/order update correctly and
// this loop tops the level back up. This is a demo liquidity provider, not a real market maker.

import { prisma, placeOrder, cancelOrder } from "@tradynance/core";

const MM_EMAIL = "market-maker@tradynance.system";
const POLL_MS = Number(process.env.MARKET_MAKER_POLL_MS ?? 12_000);
const LEVELS = 6; // price levels per side
const STEP = 0.001; // 0.1% between levels
const LEVEL_NOTIONAL = 20_000; // ~$20k target size per level
const REFRESH_DRIFT = 0.004; // re-center the ladder if mid drifts >0.4%

let running = true;

async function tick(): Promise<void> {
  const mm = await prisma.user.findUnique({ where: { email: MM_EMAIL } });
  if (!mm) {
    console.error(`[market-maker] system user ${MM_EMAIL} missing — run the seed`);
    return;
  }

  const markets = await prisma.market.findMany({
    where: { isActive: true, ticker: { isNot: null } },
    include: { ticker: true },
  });

  for (const market of markets) {
    const mid = Number(market.ticker!.lastPrice);
    if (!(mid > 0)) continue;

    const open = await prisma.order.findMany({
      where: { userId: mm.id, marketId: market.id, status: { in: ["OPEN", "PARTIALLY_FILLED"] } },
      select: { id: true, side: true, price: true },
    });
    const bids = open.filter((o) => o.side === "BUY");
    const asks = open.filter((o) => o.side === "SELL");

    // Decide whether to re-center: no book yet, or mid drifted from the ladder's center.
    let recenter = bids.length === 0 || asks.length === 0;
    if (!recenter && bids.length && asks.length) {
      const bestBid = Math.max(...bids.map((o) => Number(o.price)));
      const bestAsk = Math.min(...asks.map((o) => Number(o.price)));
      const ladderMid = (bestBid + bestAsk) / 2;
      if (Math.abs(mid - ladderMid) / mid > REFRESH_DRIFT) recenter = true;
    }

    if (recenter) {
      // Cancel the whole ladder and rebuild around the fresh mid.
      for (const o of open) await cancelOrder(prisma, { orderId: o.id, userId: mm.id });
      for (let i = 1; i <= LEVELS; i++) {
        const bidPrice = mid * (1 - i * STEP);
        const askPrice = mid * (1 + i * STEP);
        await place(mm.id, market.symbol, "BUY", bidPrice);
        await place(mm.id, market.symbol, "SELL", askPrice);
      }
    } else {
      // Top up: replace levels consumed by user trades so each side keeps ~LEVELS levels.
      for (let i = bids.length + 1; i <= LEVELS; i++) {
        await place(mm.id, market.symbol, "BUY", mid * (1 - i * STEP));
      }
      for (let i = asks.length + 1; i <= LEVELS; i++) {
        await place(mm.id, market.symbol, "SELL", mid * (1 + i * STEP));
      }
    }
  }
  console.log(`[market-maker] maintained ${markets.length} markets`);
}

async function place(userId: string, symbol: string, side: "BUY" | "SELL", price: number) {
  const qty = LEVEL_NOTIONAL / price;
  const res = await placeOrder(prisma, {
    userId,
    marketSymbol: symbol,
    side,
    type: "LIMIT",
    timeInForce: "GTC",
    price: price.toFixed(8),
    quantity: qty.toFixed(8),
  });
  if (!res.ok) {
    // Insufficient MM balance or a transient serialization conflict — log and move on.
    console.error(`[market-maker] ${side} ${symbol} @ ${price.toFixed(2)}: ${res.error}`);
  }
}

async function main(): Promise<void> {
  console.log(`[market-maker] starting — poll ${POLL_MS}ms, ${LEVELS} levels/side`);
  process.on("SIGINT", () => { running = false; });
  process.on("SIGTERM", () => { running = false; });
  while (running) {
    const started = Date.now();
    try {
      await tick();
    } catch (err) {
      console.error("[market-maker] tick failed:", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, Math.max(0, POLL_MS - (Date.now() - started))));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[market-maker] fatal:", err);
  process.exit(1);
});
