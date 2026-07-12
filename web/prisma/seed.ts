import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { seedAssets } from "./seed-assets";
import { seedMarkets } from "./seed-markets";
import { seedTickers } from "./seed-tickers";
import { seedMarketMaker } from "./seed-market-maker";
import { seedStaking } from "./seed-staking";
import { seedLaunchpad } from "./seed-launchpad";
import { seedNft } from "./seed-nft";
import { seedCms } from "./seed-cms";

async function upsertAdmin() {
  const email = "admin@tradynance.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] admin already exists: ${email}`);
    return existing;
  }

  await auth.api.signUpEmail({
    body: {
      email,
      password: "ChangeMe123!",
      name: "admin",
      username: "admin",
      country: "Nigeria",
    },
  });

  const user = await prisma.user.update({
    where: { email },
    data: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      kycStatus: "VERIFIED",
      emailVerified: true,
    },
  });

  console.log(`[seed] created admin: ${email} / ChangeMe123! (change immediately)`);
  return user;
}

async function main() {
  await upsertAdmin();
  await seedAssets();
  await seedMarkets();
  await seedTickers(); // static fallback prices; market-data overwrites with live once running
  await seedMarketMaker();
  await seedStaking();
  await seedLaunchpad();
  await seedNft();
  await seedCms();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
