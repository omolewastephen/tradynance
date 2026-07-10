import { prisma } from "../src/lib/prisma";

// Spot markets: each base coin quoted in USDT. The upstream market-data source
// (data-api.binance.vision) is polled by services/market-data using `dataSourceSymbol`.
// USDT/USDC are quote/stable assets, so they don't get their own market.
const BASES = [
  "BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "TRX",
  "LTC", "ADA", "MATIC", "AVAX", "BCH", "LINK", "TON",
];

export async function seedMarkets() {
  const usdt = await prisma.asset.findUnique({ where: { symbol: "USDT" } });
  if (!usdt) {
    console.log("[seed] USDT asset missing — run asset seed first");
    return;
  }

  for (const base of BASES) {
    const baseAsset = await prisma.asset.findUnique({ where: { symbol: base } });
    if (!baseAsset) continue;
    const symbol = `${base}USDT`;

    await prisma.market.upsert({
      where: { symbol },
      create: {
        symbol,
        baseAssetId: baseAsset.id,
        quoteAssetId: usdt.id,
        dataSourceSymbol: symbol,
        minOrderSize: "0.0001",
        pricePrecision: 2,
        quantityPrecision: 6,
      },
      update: { dataSourceSymbol: symbol, isActive: true },
    });
  }

  const count = await prisma.market.count();
  console.log(`[seed] markets: ${count}`);
}
