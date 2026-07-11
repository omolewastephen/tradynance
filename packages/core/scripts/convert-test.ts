// Direct correctness test for convert(): spread applied, debit/credit correct, ledger
// entries + Conversion row written, value conserved minus spread, insufficient funds and
// same-asset rejected. Uses live Ticker prices, cleans up after.
import { prisma, convert, getSpotWallet, CONVERT_SPREAD_BPS } from "../src/index.js";
import { Prisma } from "../generated/prisma/index.js";

const D = (n: string | number) => new Prisma.Decimal(n);
let ok = true;
function check(name: string, pass: boolean, extra?: string) {
  console.log(pass ? "PASS" : "FAIL", "-", name, extra ?? "");
  if (!pass) ok = false;
}

const email = `cv-${Date.now()}@t.local`;

async function spot(userId: string, symbol: string) {
  const a = await prisma.asset.findUniqueOrThrow({ where: { symbol } });
  const w = await prisma.wallet.findFirst({ where: { userId, assetId: a.id, network: "SPOT" } });
  return w ? w.balance.toString() : "0";
}
async function priceOf(symbol: string) {
  if (symbol === "USDT") return D(1);
  const m = await prisma.market.findFirstOrThrow({
    where: { baseAsset: { symbol } },
    include: { ticker: true },
  });
  return D(m.ticker!.lastPrice);
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
  await prisma.wallet.update({ where: { id: w.id }, data: { balance: "10000" } });

  const btcPrice = await priceOf("BTC");

  // Convert 6400 USDT → BTC
  const res = await convert(prisma as never, {
    userId: user.id,
    fromSymbol: "USDT",
    toSymbol: "BTC",
    fromAmount: "6400",
  });
  check("convert ok", res.ok, res.ok ? "" : (res as { error: string }).error);
  if (!res.ok) return;

  const usdtBal = await spot(user.id, "USDT");
  const btcBal = await spot(user.id, "BTC");
  check("USDT debited to 3600", usdtBal === "3600", `usdt=${usdtBal}`);

  // expected BTC = 6400/price × (1 - spread)
  const spreadFactor = D(1).minus(D(CONVERT_SPREAD_BPS).dividedBy(10000));
  const expectedBtc = D("6400").dividedBy(btcPrice).times(spreadFactor);
  check(
    "BTC credited with spread applied",
    D(btcBal).minus(expectedBtc).abs().lessThan("0.00000001"),
    `btc=${btcBal} expected=${expectedBtc.toFixed(8)}`,
  );

  // Value conservation: toValue = fromValue × (1 - spread)
  const toValue = D(btcBal).times(btcPrice);
  const expectedValue = D("6400").times(spreadFactor);
  check(
    "value out = value in × (1 - spread)",
    toValue.minus(expectedValue).abs().lessThan("0.01"),
    `toValue=${toValue.toFixed(2)} expected=${expectedValue.toFixed(2)}`,
  );

  // Ledger: two CONVERSION entries (one debit, one credit)
  const entries = await prisma.ledgerEntry.count({
    where: { userId: user.id, type: "CONVERSION" },
  });
  check("two CONVERSION ledger entries", entries === 2, `count=${entries}`);

  // Conversion row recorded
  const convRow = await prisma.conversion.count({ where: { userId: user.id } });
  check("conversion row recorded", convRow === 1);

  // same-asset rejected
  const same = await convert(prisma as never, {
    userId: user.id,
    fromSymbol: "BTC",
    toSymbol: "BTC",
    fromAmount: "0.01",
  });
  check("same-asset rejected", !same.ok);

  // insufficient funds
  const broke = await convert(prisma as never, {
    userId: user.id,
    fromSymbol: "USDT",
    toSymbol: "ETH",
    fromAmount: "999999",
  });
  check("insufficient funds rejected", !broke.ok);
}

main()
  .catch((e) => { console.error(e); ok = false; })
  .finally(async () => {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } });
      await prisma.conversion.deleteMany({ where: { userId: u.id } });
      await prisma.wallet.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.$disconnect();
    process.exit(ok ? 0 : 1);
  });
