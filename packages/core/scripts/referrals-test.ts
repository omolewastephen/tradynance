// Direct correctness test for referral commissions: a referee's FEE ledger entries are turned
// into REFERRAL_COMMISSION credits on the referrer's SPOT wallet at the configured rate,
// recorded as ReferralCommission rows, idempotently (a second settle is a no-op), and a user
// with no referrer earns nothing. Cleans up after.
import {
  prisma,
  settleReferralCommissionsForUser,
  getSpotWallet,
  REFERRAL_COMMISSION_BPS,
} from "../src/index.js";
import { Prisma } from "../generated/prisma/index.js";

const D = (n: string | number) => new Prisma.Decimal(n);
let ok = true;
const check = (n: string, p: boolean, e = "") => { console.log(p ? "PASS" : "FAIL", "-", n, e); if (!p) ok = false; };

const stamp = Date.now();
const refEmail = `ref-${stamp}@t.local`;
const refereeEmail = `refd-${stamp}@t.local`;

async function mkUser(email: string, referredById?: string) {
  return prisma.user.create({
    data: {
      email, username: email.split("@")[0],
      referralCode: Math.random().toString(36).slice(2, 12).toUpperCase(),
      referredById, emailVerified: true,
    },
  });
}

async function main() {
  const referrer = await mkUser(refEmail);
  const referee = await mkUser(refereeEmail, referrer.id);
  const usdt = await prisma.asset.findUniqueOrThrow({ where: { symbol: "USDT" } });

  // Simulate two trading fees the referee has paid (as FEE ledger entries on their SPOT wallet).
  const w = await getSpotWallet(prisma as never, referee.id, usdt.id);
  const fee1 = D("12.79"), fee2 = D("6.40");
  for (const amt of [fee1, fee2]) {
    await prisma.ledgerEntry.create({
      data: {
        walletId: w.id, userId: referee.id, assetId: usdt.id, type: "FEE",
        status: "CONFIRMED", amount: amt.negated(), balanceAfter: D("0"), note: "test fee",
      },
    });
  }

  const rate = D(REFERRAL_COMMISSION_BPS).dividedBy(10000);
  const expected = fee1.plus(fee2).times(rate);

  const res = await settleReferralCommissionsForUser(prisma as never, referee.id);
  check("settled 2 fee entries", res.settled === 2, `settled=${res.settled}`);
  check("total commission = fees × rate", D(res.total).minus(expected).abs().lessThan("1e-8"),
    `total=${res.total} expected=${expected.toString()}`);

  // Referrer SPOT USDT credited by the commission
  const rw = await prisma.wallet.findFirstOrThrow({ where: { userId: referrer.id, assetId: usdt.id, network: "SPOT" } });
  check("referrer wallet credited", D(rw.balance).minus(expected).abs().lessThan("1e-8"), `bal=${rw.balance}`);

  // Ledger: two REFERRAL_COMMISSION entries for referrer
  const ledgerCount = await prisma.ledgerEntry.count({ where: { userId: referrer.id, type: "REFERRAL_COMMISSION" } });
  check("two REFERRAL_COMMISSION ledger entries", ledgerCount === 2, `count=${ledgerCount}`);

  // ReferralCommission rows
  const commissions = await prisma.referralCommission.count({ where: { referrerId: referrer.id } });
  check("two ReferralCommission rows", commissions === 2);

  // Idempotent: settling again does nothing
  const again = await settleReferralCommissionsForUser(prisma as never, referee.id);
  check("second settle is a no-op", again.settled === 0, `settled=${again.settled}`);
  const ledgerCount2 = await prisma.ledgerEntry.count({ where: { userId: referrer.id, type: "REFERRAL_COMMISSION" } });
  check("no extra ledger entries after re-settle", ledgerCount2 === 2, `count=${ledgerCount2}`);

  // Referrer earned a REFERRAL notification
  const notif = await prisma.notification.count({ where: { userId: referrer.id, type: "REFERRAL" } });
  check("referrer notified", notif >= 1, `count=${notif}`);

  // A user with no referrer earns nothing
  const orphan = await mkUser(`orph-${stamp}@t.local`);
  const ow = await getSpotWallet(prisma as never, orphan.id, usdt.id);
  await prisma.ledgerEntry.create({ data: { walletId: ow.id, userId: orphan.id, assetId: usdt.id, type: "FEE", status: "CONFIRMED", amount: D("-5"), balanceAfter: D("0") } });
  const none = await settleReferralCommissionsForUser(prisma as never, orphan.id);
  check("no-referrer earns nothing", none.settled === 0);
  await prisma.ledgerEntry.deleteMany({ where: { userId: orphan.id } });
  await prisma.wallet.deleteMany({ where: { userId: orphan.id } });
  await prisma.user.delete({ where: { id: orphan.id } });
}

main().catch((e) => { console.error(e); ok = false; }).finally(async () => {
  for (const email of [refereeEmail, refEmail]) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.referralCommission.deleteMany({ where: { OR: [{ referrerId: u.id }, { refereeId: u.id }] } });
      await prisma.notification.deleteMany({ where: { userId: u.id } });
      await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } });
      await prisma.wallet.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
});
