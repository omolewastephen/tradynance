// Correctness test for staking: stake debits principal + writes a STAKE ledger entry; reward
// accrues by elapsed time (pure); redeem returns principal + reward with STAKE + STAKING_REWARD
// entries; a locked stake can't be redeemed early; balance conserved (final = start + reward);
// insufficient funds + below-minimum rejected. Cleans up after.
import { prisma, stake, redeemStake, accruedReward, getSpotWallet } from "../src/index.js";
import { Prisma } from "../generated/prisma/index.js";

const D = (n: string | number) => new Prisma.Decimal(n);
let ok = true;
const check = (n: string, p: boolean, e = "") => { console.log(p ? "PASS" : "FAIL", "-", n, e); if (!p) ok = false; };

const email = `stk-${Date.now()}@t.local`;
const START = D("100000");

async function main() {
  // Pure accrual: 1000 @ 10% APR for exactly 1 year (locked 365) = 100.
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  check("accrual: 1000 @10% for 1y = 100",
    accruedReward(D("1000"), 1000, oneYearAgo, 0).minus("100").abs().lessThan("0.5"),
    `r=${accruedReward(D("1000"), 1000, oneYearAgo, 0).toString()}`);
  check("locked accrual caps at lock period",
    accruedReward(D("1000"), 1000, oneYearAgo, 30).lessThan("10"), // 30d cap → ~8.2
  );

  const user = await prisma.user.create({
    data: { email, username: email.split("@")[0], referralCode: Math.random().toString(36).slice(2, 12).toUpperCase(), emailVerified: true },
  });
  const usdt = await prisma.asset.findUniqueOrThrow({ where: { symbol: "USDT" } });
  const w = await getSpotWallet(prisma as never, user.id, usdt.id);
  await prisma.wallet.update({ where: { id: w.id }, data: { balance: START } });

  // A flexible product + a locked product for USDT.
  const flexible = await prisma.stakingProduct.create({ data: { assetId: usdt.id, name: "USDT Flexible", aprBps: 800, lockDays: 0, minStake: D("10") } });
  const locked = await prisma.stakingProduct.create({ data: { assetId: usdt.id, name: "USDT 30-Day", aprBps: 1200, lockDays: 30, minStake: D("10") } });

  // Below minimum rejected
  const tooSmall = await stake(prisma as never, { userId: user.id, productId: flexible.id, amount: "5" });
  check("below-minimum rejected", !tooSmall.ok);

  // Stake 5000 flexible
  const s = await stake(prisma as never, { userId: user.id, productId: flexible.id, amount: "5000" });
  check("stake ok", s.ok, s.ok ? "" : (s as { error: string }).error);
  if (!s.ok) return;

  const afterStake = await getSpotWallet(prisma as never, user.id, usdt.id);
  check("principal debited", START.minus(afterStake.balance).equals("5000"), `bal=${afterStake.balance}`);
  const stakeEntries = await prisma.ledgerEntry.count({ where: { userId: user.id, type: "STAKE" } });
  check("one STAKE ledger entry", stakeEntries === 1);

  // Backdate the position so a measurable reward has accrued (1 year).
  await prisma.stakePosition.update({ where: { id: s.positionId }, data: { startAt: oneYearAgo } });
  const expectedReward = D("5000").times("0.08"); // 8% of 5000 = 400

  // Redeem
  const r = await redeemStake(prisma as never, { userId: user.id, positionId: s.positionId });
  check("redeem ok", r.ok, r.ok ? "" : (r as { error: string }).error);
  if (!r.ok) return;
  check("reward ≈ 400 (8% of 5000 over 1y)", D(r.reward).minus(expectedReward).abs().lessThan("2"), `reward=${r.reward}`);

  const afterRedeem = await getSpotWallet(prisma as never, user.id, usdt.id);
  check("final = start + reward", D(afterRedeem.balance).minus(START.plus(r.reward)).abs().lessThan("1e-8"),
    `final=${afterRedeem.balance}`);
  const rewardEntries = await prisma.ledgerEntry.count({ where: { userId: user.id, type: "STAKING_REWARD" } });
  check("one STAKING_REWARD ledger entry", rewardEntries === 1);

  // Redeeming again fails
  const again = await redeemStake(prisma as never, { userId: user.id, positionId: s.positionId });
  check("double redeem rejected", !again.ok);

  // Locked stake can't be redeemed early
  const sl = await stake(prisma as never, { userId: user.id, productId: locked.id, amount: "1000" });
  if (sl.ok) {
    const early = await redeemStake(prisma as never, { userId: user.id, positionId: sl.positionId });
    check("locked stake can't redeem early", !early.ok, early.ok ? "unexpectedly redeemed" : "");
  }

  // Insufficient funds
  const broke = await stake(prisma as never, { userId: user.id, productId: flexible.id, amount: "9999999" });
  check("insufficient funds rejected", !broke.ok);

  // Ledger conservation: Σ entries == final balance delta from START (the locked 1000 left
  // the wallet as a STAKE debit, so both sides carry it).
  const finalWallet = await getSpotWallet(prisma as never, user.id, usdt.id);
  const rows = await prisma.ledgerEntry.findMany({ where: { userId: user.id }, select: { amount: true } });
  const sum = rows.reduce((s2, x) => s2.plus(x.amount), D(0));
  check("Σ ledger == final balance − START", sum.minus(D(finalWallet.balance).minus(START)).abs().lessThan("1e-8"),
    `sum=${sum.toString()} delta=${D(finalWallet.balance).minus(START).toString()}`);
}

main().catch((e) => { console.error(e); ok = false; }).finally(async () => {
  const u = await prisma.user.findUnique({ where: { email } });
  if (u) {
    await prisma.notification.deleteMany({ where: { userId: u.id } });
    await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } });
    await prisma.stakePosition.deleteMany({ where: { userId: u.id } });
    await prisma.wallet.deleteMany({ where: { userId: u.id } });
    await prisma.stakingProduct.deleteMany({ where: { name: { in: ["USDT Flexible", "USDT 30-Day"] }, positions: { none: {} } } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
});
