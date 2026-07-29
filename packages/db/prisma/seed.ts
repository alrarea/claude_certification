import { hashPassword } from "../../../amplify/functions/api/lib/password";
import { prisma } from "../src/client";

async function main() {
  await prisma.certification.upsert({
    where: { code: "CCAR-F" },
    update: {},
    create: {
      code: "CCAR-F",
      name: "Claude Certified Architect – Foundations (CCAR-F)",
    },
  });

  await prisma.certification.upsert({
    where: { code: "CCAR-P" },
    update: {},
    create: {
      code: "CCAR-P",
      name: "Claude Certified Architect – Professional (CCAR-P)",
    },
  });

  console.log("Seeded certifications: CCAR-F, CCAR-P");

  // Super admin: set directly here, never via a self-service or
  // admin-grantable endpoint (same principle the spec applies to admin).
  // Password comes from env, not hardcoded, so it never lands in git history -
  // set SUPER_ADMIN_INITIAL_PASSWORD before running this seed.
  const superAdminEmail = "tech@alignminds.com";
  const initialPassword = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    throw new Error("SUPER_ADMIN_INITIAL_PASSWORD is not set - required to seed the super_admin account");
  }
  const passwordHash = await hashPassword(initialPassword);
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: { role: "super_admin", emailVerifiedAt: new Date() },
    create: {
      email: superAdminEmail,
      name: "Tech Admin",
      passwordHash,
      role: "super_admin",
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Seeded super_admin: ${superAdminEmail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
