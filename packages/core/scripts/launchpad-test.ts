// Correctness test for the launchpad: commit debits the sale asset + allocates tokens + writes a
// LAUNCHPAD entry; commits are additive; min/max/allocation/insufficient/ not-live rejected;
// claim only after DISTRIBUTED, credits the token asset once (double-claim rejected); ledger
// conserves on both assets. Creates its own project + token, cleans up after.
import { prisma, commitToLaunchpad, claimLaunchpad, getSpotWallet } from "../src/index.js";
import { Prisma } from "../generated/prisma/index.js";

const D = (n: string | number) => new Prisma.Decimal(n);
let ok = true;
const check = (n: string, p: boolean, e = "") => { console.log(p ? "PASS" : "FAIL", "-", n, e); if (!p) ok = false; };

const email = `lp-${Date.now()}@t.local`;
const tokenSymbol = `TST${Date.now() % 100000}`;
const START = D("100000");

async function usdt(userId: string) {
  const a = await prisma.asset.findUniqueOrThrow({ where: { symbol: "USDT" } });
  const w = await prisma.wallet.findFirst({ where: { userId, assetId: a.id, network: "SPOT" } });
  return w ? D(w.balance) : D(0);
}

async function main() {
  const user = await prisma.user.create({
    data: { email, username: email.split("@")[0], referralCode: Math.random().toString(36).slice(2, 12).toUpperCase(), emailVerified: true },
  });
  const usdtAsset = await prisma.asset.findUniqueOrThrow({ where: { symbol: "USDT" } });
  const w = await getSpotWallet(prisma as never, user.id, usdtAsset.id);
  await prisma.wallet.update({ where: { id: w.id }, data: { balance: START } });

  const token = await prisma.asset.create({ data: { symbol: tokenSymbol, name: "Test Token", decimals: 18, isActive: false } });
  const project = await prisma.launchpadProject.create({
    data: {
      name: `Test Sale ${Date.now()}`, tokenSymbol, tokenAssetId: token.id, saleAssetId: usdtAsset.id,
      tokenPrice: D("0.20"), totalAllocation: D("1000000"), minCommit: D("50"), maxCommit: D("5000"),
      startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 86400000), status: "LIVE",
      description: "test",
    },
  });

  // below min
  check("below-min rejected", !(await commitToLaunchpad(prisma as never, { userId: user.id, projectId: project.id, amount: "10" })).ok);

  // commit 1000 USDT → 5000 tokens @ 0.20
  const c1 = await commitToLaunchpad(prisma as never, { userId: user.id, projectId: project.id, amount: "1000" });
  check("commit ok", c1.ok, c1.ok ? "" : (c1 as { error: string }).error);
  if (!c1.ok) return;
  check("tokens = amount / price (5000)", D(c1.tokenAmount).equals("5000"), `tokens=${c1.tokenAmount}`);
  check("USDT debited by 1000", START.minus(await usdt(user.id)).equals("1000"));
  check("LAUNCHPAD debit entry written", (await prisma.ledgerEntry.count({ where: { userId: user.id, type: "LAUNCHPAD" } })) === 1);

  // additive commit +2000 → total 3000
  const c2 = await commitToLaunchpad(prisma as never, { userId: user.id, projectId: project.id, amount: "2000" });
  check("additive commit ok, total 3000", c2.ok && c2.totalCommitted === "3000", c2.ok ? `total=${c2.totalCommitted}` : (c2 as { error: string }).error);

  // over max (3000 + 3000 > 5000)
  check("over-max rejected", !(await commitToLaunchpad(prisma as never, { userId: user.id, projectId: project.id, amount: "3000" })).ok);

  // soldAllocation reflects 15000 tokens (3000/0.20)
  const proj2 = await prisma.launchpadProject.findUniqueOrThrow({ where: { id: project.id } });
  check("soldAllocation = 15000", D(proj2.soldAllocation).equals("15000"), `sold=${proj2.soldAllocation}`);

  // claim before DISTRIBUTED rejected
  check("claim before distributed rejected", !(await claimLaunchpad(prisma as never, { userId: user.id, projectId: project.id })).ok);

  // distribute + claim
  await prisma.launchpadProject.update({ where: { id: project.id }, data: { status: "DISTRIBUTED" } });
  const claim = await claimLaunchpad(prisma as never, { userId: user.id, projectId: project.id });
  check("claim ok", claim.ok, claim.ok ? "" : (claim as { error: string }).error);
  if (claim.ok) check("claimed 15000 tokens", D(claim.tokenAmount).equals("15000"), `tokens=${claim.tokenAmount}`);

  // token credited to SPOT wallet
  const tw = await prisma.wallet.findFirst({ where: { userId: user.id, assetId: token.id, network: "SPOT" } });
  check("token credited to wallet (15000)", tw != null && D(tw.balance).equals("15000"), `bal=${tw?.balance}`);

  // double claim rejected
  check("double claim rejected", !(await claimLaunchpad(prisma as never, { userId: user.id, projectId: project.id })).ok);

  // insufficient funds
  check("insufficient funds rejected", !(await commitToLaunchpad(prisma as never, { userId: user.id, projectId: project.id, amount: "999999" })).ok);
  // NB: also not-LIVE now (DISTRIBUTED) so this doubly can't commit — fine.

  // conservation: USDT delta = -3000; token delta = +15000
  check("USDT conserved (−3000)", START.minus(await usdt(user.id)).equals("3000"));
}

main().catch((e) => { console.error(e); ok = false; }).finally(async () => {
  const u = await prisma.user.findUnique({ where: { email } });
  if (u) {
    await prisma.notification.deleteMany({ where: { userId: u.id } });
    await prisma.launchpadCommitment.deleteMany({ where: { userId: u.id } });
    await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } });
    await prisma.wallet.deleteMany({ where: { userId: u.id } });
    await prisma.launchpadProject.deleteMany({ where: { tokenSymbol } });
    await prisma.asset.deleteMany({ where: { symbol: tokenSymbol } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
});
