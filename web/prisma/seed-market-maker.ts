import { prisma } from "../src/lib/prisma";
import { SPOT_NETWORK } from "@tradynance/core";

// A system user whose resting orders provide order-book liquidity (see services/market-maker).
// Funded with large SPOT balances so it can quote both sides of every market. Not a real
// counterparty — a demo liquidity provider. Excluded from user-facing admin lists by email.
const MM_EMAIL = "market-maker@tradynance.system";

// Generous SPOT balances per asset so the MM never runs dry quoting 6 levels/side.
const BALANCES: Record<string, string> = {
  USDT: "500000000",
  BTC: "5000",
  ETH: "100000",
  BNB: "500000",
  SOL: "5000000",
  XRP: "200000000",
  DOGE: "2000000000",
  TRX: "1000000000",
  LTC: "3000000",
  ADA: "1000000000",
  MATIC: "300000000",
  AVAX: "5000000",
  BCH: "1000000",
  LINK: "20000000",
  TON: "50000000",
};

export async function seedMarketMaker() {
  let mm = await prisma.user.findUnique({ where: { email: MM_EMAIL } });
  if (!mm) {
    mm = await prisma.user.create({
      data: {
        email: MM_EMAIL,
        username: "market_maker",
        name: "Market Maker",
        emailVerified: true,
        status: "ACTIVE",
        referralCode: "MARKETMAKER",
      },
    });
  }

  for (const [symbol, balance] of Object.entries(BALANCES)) {
    const asset = await prisma.asset.findUnique({ where: { symbol } });
    if (!asset) continue;
    const existing = await prisma.wallet.findFirst({
      where: { userId: mm.id, assetId: asset.id, network: SPOT_NETWORK },
    });
    if (existing) {
      // Top the balance back up (in case earlier runs consumed it) without disturbing locks.
      await prisma.wallet.update({ where: { id: existing.id }, data: { balance } });
    } else {
      await prisma.wallet.create({
        data: { userId: mm.id, assetId: asset.id, network: SPOT_NETWORK, balance },
      });
    }
  }

  console.log(`[seed] market-maker funded (${Object.keys(BALANCES).length} SPOT wallets)`);
}
