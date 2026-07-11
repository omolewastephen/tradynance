// Tradynance liquidation engine — standalone risk service for isolated-margin futures.
//
// Two jobs, both driven off the Ticker mark-price cache:
//   1. Liquidation (every POLL_MS): mark every OPEN position to its market's live price and, for
//      any whose equity has fallen to/below maintenance margin, force-close it via the core
//      liquidatePosition path (same transactional settlement as a user close — the residual
//      equity, if any, is returned; the deficit is the platform's).
//   2. Funding (every FUNDING_INTERVAL_MS): accrue one funding payment onto each open position
//      (LONG pays when the rate is positive), realized into the settlement figure at close.
//
// The maths live in packages/core/src/futures.ts (isLiquidatable / liquidatePosition /
// accrueFunding); this service is only the scheduler + mark-price source, exactly like the
// chain-watcher and market-maker are thin loops over core money functions.

import {
  Prisma,
  prisma,
  isLiquidatable,
  liquidatePosition,
  accrueFunding,
  DEFAULT_FUNDING_RATE,
  FUNDING_INTERVAL_MS,
} from "@tradynance/core";

const D = (n: string | number | Prisma.Decimal) => new Prisma.Decimal(n);
const POLL_MS = Number(process.env.LIQUIDATION_POLL_MS ?? 5_000);

let running = true;
let lastFundingAt = 0;

/** Load OPEN positions with their market's live mark price. */
async function openPositions() {
  return prisma.futuresPosition.findMany({
    where: { status: "OPEN" },
    include: { market: { include: { ticker: true } } },
  });
}

async function sweepLiquidations(): Promise<void> {
  const positions = await openPositions();
  for (const p of positions) {
    const ticker = p.market.ticker;
    if (!ticker) continue;
    const mark = D(ticker.lastPrice);
    if (!(mark.greaterThan(0))) continue;

    if (isLiquidatable(p.side, D(p.entryPrice), mark, D(p.size), D(p.margin), D(p.fundingAccrued))) {
      const res = await liquidatePosition(prisma, { positionId: p.id, markPrice: mark.toString() });
      if (res.ok) {
        console.log(
          `[liquidation] ${p.side} ${p.market.symbol} pos=${p.id} @ ${mark.toFixed(2)} ` +
            `returned=${Number(res.returned).toFixed(2)} pnl=${Number(res.realizedPnl).toFixed(2)}`,
        );
      } else {
        console.error(`[liquidation] pos=${p.id}: ${res.error}`);
      }
    }
  }
}

async function sweepFunding(): Promise<void> {
  const positions = await openPositions();
  let applied = 0;
  for (const p of positions) {
    const ticker = p.market.ticker;
    if (!ticker) continue;
    const res = await accrueFunding(prisma, {
      positionId: p.id,
      markPrice: ticker.lastPrice.toString(),
      rate: DEFAULT_FUNDING_RATE.toString(),
    });
    if (res.ok) applied++;
  }
  if (applied > 0) {
    console.log(`[funding] accrued on ${applied} position(s) @ rate ${DEFAULT_FUNDING_RATE.toString()}`);
  }
}

async function tick(): Promise<void> {
  await sweepLiquidations();
  const now = Date.now();
  if (now - lastFundingAt >= FUNDING_INTERVAL_MS) {
    await sweepFunding();
    lastFundingAt = now;
  }
}

async function main(): Promise<void> {
  console.log(
    `[liquidation-engine] starting — poll ${POLL_MS}ms, funding every ${FUNDING_INTERVAL_MS}ms`,
  );
  // Don't fire a funding round the instant we boot — wait a full interval first.
  lastFundingAt = Date.now();
  process.on("SIGINT", () => { running = false; });
  process.on("SIGTERM", () => { running = false; });
  while (running) {
    const started = Date.now();
    try {
      await tick();
    } catch (err) {
      console.error("[liquidation-engine] tick failed:", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, Math.max(0, POLL_MS - (Date.now() - started))));
  }
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[liquidation-engine] fatal:", err);
  process.exit(1);
});
