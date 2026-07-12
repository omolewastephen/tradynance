// CI seed: the minimum the core money-test suite needs — assets, markets, and static tickers.
// Deliberately NO market-maker (its resting liquidity would cross the trading-test's own orders)
// and none of the demo product seeds (each test creates its own throwaway data). Fast + isolated.
import { prisma } from "../src/lib/prisma";
import { seedAssets } from "./seed-assets";
import { seedMarkets } from "./seed-markets";
import { seedTickers } from "./seed-tickers";

async function main() {
  await seedAssets();
  await seedMarkets();
  await seedTickers();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
