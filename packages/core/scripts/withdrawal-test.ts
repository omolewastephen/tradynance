// Direct correctness test for the withdrawal money functions. Creates a throwaway user +
// funded wallet, exercises reserve/settle/release incl. idempotency and insufficient-funds,
// asserts ledger + balance math, then cleans up. Run: tsx --env-file scripts/withdrawal-test.ts
import { prisma } from "../src/prisma.js";
import {
  reserveWithdrawalFunds,
  settleWithdrawal,
  releaseWithdrawal,
  InsufficientFundsError,
} from "../src/withdrawal.js";

let ok = true;
function check(name: string, pass: boolean) {
  console.log(pass ? "PASS" : "FAIL", "-", name);
  if (!pass) ok = false;
}

const SUFFIX = Date.now();
const email = `wtest-${SUFFIX}@example.local`;

async function main() {
  const asset = await prisma.asset.findUniqueOrThrow({ where: { symbol: "BTC" } });

  const user = await prisma.user.create({
    data: {
      email,
      username: `wtest${SUFFIX}`,
      referralCode: `WT${SUFFIX}`.slice(0, 12),
      emailVerified: true,
    },
  });

  // Fund a wallet with 10 BTC (test-only direct write; real credits go through creditDeposit).
  const wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      assetId: asset.id,
      network: "BTC_TESTNET",
      balance: "10",
      lockedBalance: "0",
    },
  });

  async function freshWithdrawal(amount: string, fee: string) {
    return prisma.withdrawal.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        network: "BTC_TESTNET",
        amount,
        fee,
        destinationAddress: "tb1qexampledestaddressxxxxxxxxxxxxxxxxxxx",
        status: "AWAITING_CONFIRMATION",
      },
    });
  }
  const readWallet = () => prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

  // ---- reserve ----
  const w1 = await freshWithdrawal("2", "0.0001");
  await reserveWithdrawalFunds(prisma, w1.id);
  let wal = await readWallet();
  check("reserve locks amount+fee", wal.lockedBalance.toString() === "2.0001");
  check("reserve leaves balance untouched", wal.balance.toString() === "10");
  let w1row = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w1.id } });
  check("reserve flips to PENDING", w1row.status === "PENDING");

  // ---- reserve idempotency ----
  await reserveWithdrawalFunds(prisma, w1.id);
  wal = await readWallet();
  check("reserve is idempotent (locked still 2.0001)", wal.lockedBalance.toString() === "2.0001");

  // ---- insufficient funds ----
  // available now = 10 - 2.0001 = 7.9999; request 8 should fail.
  const wBig = await freshWithdrawal("8", "0.0001");
  let threw = false;
  try {
    await reserveWithdrawalFunds(prisma, wBig.id);
  } catch (e) {
    threw = e instanceof InsufficientFundsError;
  }
  check("insufficient funds rejected", threw);
  wal = await readWallet();
  check("failed reserve didn't change lock", wal.lockedBalance.toString() === "2.0001");

  // ---- settle ----
  const settle = await settleWithdrawal(prisma, { withdrawalId: w1.id, actorId: "admin-test" });
  check("settle reports settled", settle.settled === true);
  wal = await readWallet();
  check("settle debits balance (10 - 2.0001)", wal.balance.toString() === "7.9999");
  check("settle releases the lock", wal.lockedBalance.toString() === "0");
  const ledgerCount = await prisma.ledgerEntry.count({
    where: { referenceType: "Withdrawal", referenceId: w1.id },
  });
  check("settle writes exactly one ledger entry", ledgerCount === 1);
  const entry = await prisma.ledgerEntry.findFirstOrThrow({
    where: { referenceType: "Withdrawal", referenceId: w1.id },
  });
  check("ledger entry is negative amount+fee", entry.amount.toString() === "-2.0001");
  check("ledger balanceAfter matches", entry.balanceAfter.toString() === "7.9999");

  // ---- settle idempotency ----
  const settle2 = await settleWithdrawal(prisma, { withdrawalId: w1.id });
  check("settle is idempotent (no re-settle)", settle2.settled === false);
  wal = await readWallet();
  check("balance unchanged after re-settle", wal.balance.toString() === "7.9999");
  const ledgerCount2 = await prisma.ledgerEntry.count({
    where: { referenceType: "Withdrawal", referenceId: w1.id },
  });
  check("still exactly one ledger entry", ledgerCount2 === 1);

  // ---- release (reject) path ----
  const w2 = await freshWithdrawal("1", "0.0001");
  await reserveWithdrawalFunds(prisma, w2.id);
  wal = await readWallet();
  check("second reserve locks 1.0001", wal.lockedBalance.toString() === "1.0001");
  await releaseWithdrawal(prisma, { withdrawalId: w2.id, status: "REJECTED", reason: "test" });
  wal = await readWallet();
  check("release unlocks the funds", wal.lockedBalance.toString() === "0");
  check("release doesn't move balance", wal.balance.toString() === "7.9999");
  const rejectedLedger = await prisma.ledgerEntry.count({
    where: { referenceType: "Withdrawal", referenceId: w2.id },
  });
  check("rejected withdrawal writes NO ledger entry", rejectedLedger === 0);
  w1row = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w2.id } });
  check("rejected status set", w1row.status === "REJECTED");

  // ---- release idempotency ----
  const rel2 = await releaseWithdrawal(prisma, { withdrawalId: w2.id, status: "REJECTED" });
  check("release is idempotent (terminal no-op)", rel2.released === false);
}

main()
  .catch((err) => {
    console.error(err);
    ok = false;
  })
  .finally(async () => {
    // cleanup
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });
      await prisma.withdrawal.deleteMany({ where: { userId: user.id } });
      await prisma.wallet.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
    process.exit(ok ? 0 : 1);
  });
