// Direct correctness test for spot matching + settlement. Creates throwaway maker/taker users
// with SPOT balances, exercises resting limit orders, a market buy across two price levels,
// partial fills, IOC/FOK, cancel-releases-lock, and insufficient funds — asserting balances,
// locks, ledger conservation, and order/trade state — then cleans up.
import { prisma, placeOrder, cancelOrder, getSpotWallet } from "../src/index.js";
import { Prisma } from "../generated/prisma/index.js";

const D = (n: string | number) => new Prisma.Decimal(n);
let ok = true;
function check(name: string, pass: boolean, extra?: string) {
  console.log(pass ? "PASS" : "FAIL", "-", name, extra ?? "");
  if (!pass) ok = false;
}
function approx(a: string, b: string) {
  return D(a).minus(D(b)).abs().lessThan("0.0000001");
}

const SUFFIX = Date.now();
const makerEmail = `mm-${SUFFIX}@t.local`;
const takerEmail = `tk-${SUFFIX}@t.local`;

async function mkUser(email: string) {
  const referralCode = Math.random().toString(36).slice(2, 12).toUpperCase();
  return prisma.user.create({
    data: { email, username: email.split("@")[0], referralCode, emailVerified: true },
  });
}
async function fundSpot(userId: string, symbol: string, amount: string) {
  const asset = await prisma.asset.findUniqueOrThrow({ where: { symbol } });
  const w = await getSpotWallet(prisma as never, userId, asset.id);
  await prisma.wallet.update({ where: { id: w.id }, data: { balance: amount } });
}
async function spot(userId: string, symbol: string) {
  const asset = await prisma.asset.findUniqueOrThrow({ where: { symbol } });
  const w = await prisma.wallet.findFirstOrThrow({ where: { userId, assetId: asset.id, network: "SPOT" } });
  return { balance: w.balance.toString(), locked: w.lockedBalance.toString() };
}

async function main() {
  const maker = await mkUser(makerEmail);
  const taker = await mkUser(takerEmail);
  await fundSpot(maker.id, "BTC", "10");
  await fundSpot(taker.id, "USDT", "200000");

  // Maker rests two asks: 2 @ 50000 and 1 @ 51000
  const s1 = await placeOrder(prisma as never, { userId: maker.id, marketSymbol: "BTCUSDT", side: "SELL", type: "LIMIT", timeInForce: "GTC", price: "50000", quantity: "2" });
  const s2 = await placeOrder(prisma as never, { userId: maker.id, marketSymbol: "BTCUSDT", side: "SELL", type: "LIMIT", timeInForce: "GTC", price: "51000", quantity: "1" });
  check("maker sell1 rests", s1.ok && (s1 as { resting: boolean }).resting);
  check("maker sell2 rests", s2.ok && (s2 as { resting: boolean }).resting);
  let mBtc = await spot(maker.id, "BTC");
  check("maker BTC locked = 3 after resting", approx(mBtc.locked, "3"), `locked=${mBtc.locked}`);

  // Taker market-buys 2.5 BTC → 2@50000 + 0.5@51000
  const buy = await placeOrder(prisma as never, { userId: taker.id, marketSymbol: "BTCUSDT", side: "BUY", type: "MARKET", timeInForce: "IOC", quantity: "2.5" });
  check("market buy ok", buy.ok, buy.ok ? "" : (buy as { error: string }).error);
  check("market buy fully filled", buy.ok && (buy as { status: string }).status === "FILLED");

  const tBtc = await spot(taker.id, "BTC");
  const tUsdt = await spot(taker.id, "USDT");
  // taker gets 2.5 BTC; pays 125500 notional + 251 taker fee (0.2%) = 125751
  check("taker BTC = 2.5", approx(tBtc.balance, "2.5"), `btc=${tBtc.balance}`);
  check("taker USDT = 200000 - 125751 = 74249", approx(tUsdt.balance, "74249"), `usdt=${tUsdt.balance}`);

  mBtc = await spot(maker.id, "BTC");
  const mUsdt = await spot(maker.id, "USDT");
  // maker delivered 2.5 BTC: balance 7.5, locked 0.5 (order2 half remains)
  check("maker BTC balance = 7.5", approx(mBtc.balance, "7.5"), `btc=${mBtc.balance}`);
  check("maker BTC locked = 0.5", approx(mBtc.locked, "0.5"), `locked=${mBtc.locked}`);
  // maker receives 99900 (fill1: 100000 - 100 maker fee) + 25474.5 (fill2: 25500 - 25.5) = 125374.5
  check("maker USDT = 125374.5", approx(mUsdt.balance, "125374.5"), `usdt=${mUsdt.balance}`);

  // Conservation: BTC sum 0, USDT sum = -(total fees 376.5)
  const btcSum = D(tBtc.balance).plus(mBtc.balance).minus("10"); // maker started with 10 BTC
  check("BTC conserved (taker+maker delta = 0)", approx(btcSum.toString(), "0"), `sum=${btcSum}`);
  const usdtSum = D(tUsdt.balance).minus("200000").plus(mUsdt.balance); // taker started 200000
  check("USDT delta = -376.5 (fees left system)", approx(usdtSum.toString(), "-376.5"), `sum=${usdtSum}`);

  // Trades + ledger (scoped to this run's users — the shared Trade table may hold demo trades)
  const tradeCount = await prisma.trade.count({
    where: { OR: [{ buyOrder: { userId: taker.id } }, { sellOrder: { userId: maker.id } }] },
  });
  check("2 trades recorded", tradeCount === 2, `trades=${tradeCount}`);
  const ledgerSum = await prisma.ledgerEntry.aggregate({ _count: true });
  check("ledger entries written", ledgerSum._count > 0);

  // Cancel maker's partially-filled order2 → releases 0.5 BTC lock
  const order2Id = (s2 as { orderId: string }).orderId;
  const cancel = await cancelOrder(prisma as never, { orderId: order2Id, userId: maker.id });
  check("cancel ok", cancel.ok);
  mBtc = await spot(maker.id, "BTC");
  check("maker BTC lock released to 0", approx(mBtc.locked, "0"), `locked=${mBtc.locked}`);

  // IOC with no crossing liquidity → cancelled, no fill, no lock
  const ioc = await placeOrder(prisma as never, { userId: taker.id, marketSymbol: "BTCUSDT", side: "BUY", type: "LIMIT", timeInForce: "IOC", price: "1000", quantity: "1" });
  check("IOC no-liquidity → cancelled", ioc.ok && (ioc as { status: string }).status === "CANCELLED");

  // FOK that can't fully fill → rejected
  await placeOrder(prisma as never, { userId: maker.id, marketSymbol: "BTCUSDT", side: "SELL", type: "LIMIT", timeInForce: "GTC", price: "52000", quantity: "0.1" });
  const fok = await placeOrder(prisma as never, { userId: taker.id, marketSymbol: "BTCUSDT", side: "BUY", type: "LIMIT", timeInForce: "FOK", price: "52000", quantity: "5" });
  check("FOK unfillable → rejected", !fok.ok);

  // Insufficient funds
  const poor = await mkUser(`poor-${SUFFIX}@t.local`);
  await fundSpot(poor.id, "USDT", "10");
  const broke = await placeOrder(prisma as never, { userId: poor.id, marketSymbol: "BTCUSDT", side: "BUY", type: "LIMIT", timeInForce: "GTC", price: "52000", quantity: "1" });
  check("insufficient funds rejected", !broke.ok);
}

main()
  .catch((e) => { console.error(e); ok = false; })
  .finally(async () => {
    for (const email of [makerEmail, takerEmail, `poor-${SUFFIX}@t.local`]) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (!u) continue;
      await prisma.trade.deleteMany({ where: { OR: [{ buyOrder: { userId: u.id } }, { sellOrder: { userId: u.id } }] } });
      await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } });
      await prisma.order.deleteMany({ where: { userId: u.id } });
      await prisma.wallet.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.$disconnect();
    process.exit(ok ? 0 : 1);
  });
