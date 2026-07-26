import { prisma } from "../src/client";

async function main() {
  await prisma.certification.upsert({
    where: { code: "CCAF" },
    update: {},
    create: {
      code: "CCAF",
      name: "Claude Certified Architect – Foundations (CCAR-F)",
    },
  });

  await prisma.certification.upsert({
    where: { code: "CCAP" },
    update: {},
    create: {
      code: "CCAP",
      name: "Claude Certified Architect – Professional (CCAR-P)",
    },
  });

  console.log("Seeded certifications: CCAF, CCAP");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
