import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
