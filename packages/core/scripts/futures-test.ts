// Direct correctness test for the isolated-margin futures engine. Verifies: open debits
// margin + taker fee and writes FUTURES_MARGIN + FEE ledger entries; size/entry/liq price;
// unrealized PnL + equity pure fns; close realizes PnL at a moved mark and credits
// margin+uPnL−fee; liquidation seizes margin at a breach; funding accrues; leverage/margin
// limits + insufficient funds rejected; ledger conserves (Σ entries == balance delta).
// Temporarily nudges the Ticker to simulate mark moves, restores it, cleans up after.
import {
  prisma,
  openPosition,
  closePosition,
  liquidatePosition,
  accrueFunding,
  getSpotWallet,
  unrealizedPnl,
  positionEquity,
  isLiquidatable,
  liquidationPriceFor,
  MAX_LEVERAGE,
} from "../src/index.js";
import { Prisma } from "../generated/prisma/index.js";

const D = (n: string | number | Prisma.Decimal) => new Prisma.Decimal(n);
let ok = true;
function check(name: string, pass: boolean, extra?: string) {
  console.log(pass ? "PASS" : "FAIL", "-", name, extra ?? "");
  if (!pass) ok = false;
}

const email = `fut-${Date.now()}@t.local`;
const START = D("100000");

async function usdtBalance(userId: string) {
  const a = await prisma.asset.findUniqueOrThrow({ where: { symbol: "USDT" } });
  const w = await prisma.wallet.findFirst({ where: { userId, assetId: a.id, network: "SPOT" } });
  return w ? D(w.balance) : D(0);
}
async function ledgerSum(userId: string) {
  const rows = await prisma.ledgerEntry.findMany({ where: { userId }, select: { amount: true } });
  return rows.reduce((s, r) => s.plus(r.amount), D(0));
}

async function main() {
  const user = await prisma.user.create({
    data: {
      email,
      username: email.split("@")[0],
      referralCode: Math.random().toString(36).slice(2, 12).toUpperCase(),
      emailVerified: true,
    },
  });
  const usdt = await prisma.asset.findUniqueOrThrow({ where: { symbol: "USDT" } });
  const w = await getSpotWallet(prisma as never, user.id, usdt.id);
  await prisma.wallet.update({ where: { id: w.id }, data: { balance: START } });

  const market = await prisma.market.findFirstOrThrow({
    where: { baseAsset: { symbol: "BTC" }, quoteAsset: { symbol: "USDT" }, ticker: { isNot: null } },
    include: { ticker: true },
  });
  const symbol = market.symbol;
  const takerBps = market.takerFeeBps;
  const origMark = D(market.ticker!.lastPrice);

  // ── Pure fns ──
  const entry = D("100"), size = D("100");
  check("uPnl LONG", unrealizedPnl("LONG", entry, D("105"), size).equals("500"));
  check("uPnl SHORT", unrealizedPnl("SHORT", entry, D("105"), size).equals("-500"));
  check(
    "equity = margin + uPnl - funding",
    positionEquity("LONG", entry, D("105"), size, D("1000"), D("10")).equals("1490"),
  );
  check("not liquidatable when healthy", !isLiquidatable("LONG", entry, D("105"), size, D("1000"), D("0")));
  check("liquidatable when equity ≤ maintenance", isLiquidatable("LONG", entry, D("90.4"), size, D("1000"), D("0")));
  check(
    "liq price LONG below entry, SHORT above",
    liquidationPriceFor("LONG", entry, 10).lessThan(entry) &&
      liquidationPriceFor("SHORT", entry, 10).greaterThan(entry),
  );

  // ── Open LONG 10x, margin 1000 ──
  const MARGIN = D("1000");
  const LEV = 10;
  const open = await openPosition(prisma as never, {
    userId: user.id, marketSymbol: symbol, side: "LONG", leverage: LEV, margin: MARGIN.toString(),
  });
  check("open ok", open.ok, open.ok ? "" : (open as { error: string }).error);
  if (!open.ok) return;

  const notional = MARGIN.times(LEV);
  const expectedSize = notional.dividedBy(origMark);
  const openFee = notional.times(takerBps).dividedBy(10000);
  check("size = notional / entry", D(open.size).minus(expectedSize).abs().lessThan("1e-18"),
    `size=${open.size}`);
  check("entry = live mark", D(open.entryPrice).equals(origMark));
  check("open fee = notional × takerBps", D(open.fee).minus(openFee).abs().lessThan("1e-8"));

  const afterOpen = await usdtBalance(user.id);
  check("spot debited margin + fee", START.minus(afterOpen).minus(MARGIN.plus(openFee)).abs().lessThan("1e-8"),
    `debited=${START.minus(afterOpen).toString()}`);
  const marginEntries = await prisma.ledgerEntry.count({ where: { userId: user.id, type: "FUTURES_MARGIN" } });
  check("one FUTURES_MARGIN entry", marginEntries === 1);

  // ── Close at +5% mark → realize PnL ──
  const upMark = origMark.times("1.05");
  await prisma.ticker.update({ where: { marketId: market.id }, data: { lastPrice: upMark } });
  const close = await closePosition(prisma as never, { userId: user.id, positionId: open.positionId });
  await prisma.ticker.update({ where: { marketId: market.id }, data: { lastPrice: origMark } }); // restore
  check("close ok", close.ok, close.ok ? "" : (close as { error: string }).error);
  if (!close.ok) return;

  const uPnl = unrealizedPnl("LONG", origMark, upMark, expectedSize); // = 0.05 × notional = 500
  const closeFee = upMark.times(expectedSize).times(takerBps).dividedBy(10000);
  const expectedReturn = MARGIN.plus(uPnl).minus(closeFee);
  check("uPnl ≈ 500 (5% of 10k notional)", uPnl.minus("500").abs().lessThan("1e-6"), `uPnl=${uPnl.toString()}`);
  check("returned = margin + uPnl - closeFee",
    D(close.returned).minus(expectedReturn).abs().lessThan("1e-6"), `ret=${close.returned}`);

  const afterClose = await usdtBalance(user.id);
  // conservation: final = start − openFee − closeFee + uPnl
  const expectedFinal = START.minus(openFee).minus(closeFee).plus(uPnl);
  check("balance conserved (start − fees + uPnl)",
    afterClose.minus(expectedFinal).abs().lessThan("1e-6"),
    `final=${afterClose.toString()} expected=${expectedFinal.toString()}`);

  const posClosed = await prisma.futuresPosition.findUniqueOrThrow({ where: { id: open.positionId } });
  check("position CLOSED", posClosed.status === "CLOSED");
  check("realizedPnl = returned - margin",
    D(posClosed.realizedPnl).minus(D(close.returned).minus(MARGIN)).abs().lessThan("1e-6"));

  // ── Ledger conservation: Σ entries == balance delta from START ──
  const sum = await ledgerSum(user.id);
  check("Σ ledger == balance − START", sum.minus(afterClose.minus(START)).abs().lessThan("1e-8"),
    `sum=${sum.toString()} delta=${afterClose.minus(START).toString()}`);

  // ── Liquidation: open fresh 10x LONG, drop mark below liq → force close seizes margin ──
  const open2 = await openPosition(prisma as never, {
    userId: user.id, marketSymbol: symbol, side: "LONG", leverage: 10, margin: "1000",
  });
  if (!open2.ok) { check("open2 ok", false, open2.error); return; }
  const crashMark = origMark.times("0.90"); // −10% ≈ full loss for 10x
  check("engine flags liquidatable at crash",
    isLiquidatable("LONG", origMark, crashMark, D(open2.size), D("1000"), D("0")));
  const liq = await liquidatePosition(prisma as never, { positionId: open2.positionId, markPrice: crashMark.toString() });
  check("liquidate ok", liq.ok, liq.ok ? "" : (liq as { error: string }).error);
  if (liq.ok) {
    check("liquidation returns ≈ 0 (margin seized)", D(liq.returned).abs().lessThan("1"), `ret=${liq.returned}`);
    check("liquidation realizedPnl ≈ −margin", D(liq.realizedPnl).plus("1000").abs().lessThan("1"), `pnl=${liq.realizedPnl}`);
  }
  const posLiq = await prisma.futuresPosition.findUniqueOrThrow({ where: { id: open2.positionId } });
  check("position LIQUIDATED", posLiq.status === "LIQUIDATED");

  // ── Funding accrual ──
  const open3 = await openPosition(prisma as never, {
    userId: user.id, marketSymbol: symbol, side: "LONG", leverage: 5, margin: "500",
  });
  if (open3.ok) {
    const fund = await accrueFunding(prisma as never, { positionId: open3.positionId, markPrice: origMark.toString(), rate: "0.0001" });
    const expectedFunding = origMark.times(D(open3.size)).times("0.0001");
    check("funding accrues LONG positive", fund.ok && D(fund.fundingAccrued!).minus(expectedFunding).abs().lessThan("1e-8"),
      `funding=${fund.fundingAccrued}`);
    await closePosition(prisma as never, { userId: user.id, positionId: open3.positionId }); // cleanup open
  }

  // ── Validation ──
  const badLev = await openPosition(prisma as never, { userId: user.id, marketSymbol: symbol, side: "LONG", leverage: MAX_LEVERAGE + 1, margin: "100" });
  check("leverage over max rejected", !badLev.ok);
  const zeroLev = await openPosition(prisma as never, { userId: user.id, marketSymbol: symbol, side: "LONG", leverage: 0, margin: "100" });
  check("leverage 0 rejected", !zeroLev.ok);
  const zeroMargin = await openPosition(prisma as never, { userId: user.id, marketSymbol: symbol, side: "LONG", leverage: 5, margin: "0" });
  check("margin 0 rejected", !zeroMargin.ok);
  const broke = await openPosition(prisma as never, { userId: user.id, marketSymbol: symbol, side: "LONG", leverage: 5, margin: "9999999" });
  check("insufficient funds rejected", !broke.ok);
}

main()
  .catch((e) => { console.error(e); ok = false; })
  .finally(async () => {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } });
      await prisma.futuresPosition.deleteMany({ where: { userId: u.id } });
      await prisma.wallet.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.$disconnect();
    process.exit(ok ? 0 : 1);
  });
