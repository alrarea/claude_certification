/**
 * Gives the ten exam-logistics topics an in_depth row in a translated locale,
 * by copying that locale's normal text - which is exactly what English does.
 *
 * Registration, policies, sample-question walkthroughs and revision checklists
 * are not subject matter: there is no problem being solved, no implementation
 * and no failure mode, so the nine-step in-depth contract has nothing to
 * attach to. English resolves this by storing the normal text in both modes,
 * and `check-content-drift.ts` reports them as META rather than failing them.
 *
 * A translation has to make the same move for the same reason. Translating
 * them a second time would spend money to produce a near-identical page, and
 * the in-depth lint would reject the result nine ways. Leaving the row out
 * instead would send a Malayalam reader who switches to In-depth back to an
 * English page on those topics alone, which reads as a bug.
 *
 * Idempotent, and never touches a topic that has an exam domain. Not part of
 * any Lambda runtime path. Usage:
 *   npm run content:mirror-meta -- --locale ml
 *   npm run content:mirror-meta -- --locale ml --dry-run
 */
import { DEFAULT_LOCALE, LOCALES, parseLocale } from "@claude-cert/shared";
import { prisma } from "../src/client";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const locale = parseLocale(flag("locale") ?? "ml");
  if (!locale) throw new Error(`--locale must be one of ${LOCALES.join(", ")}`);
  if (locale === DEFAULT_LOCALE) {
    throw new Error(`${DEFAULT_LOCALE} already stores both modes - nothing to mirror`);
  }
  const dryRun = process.argv.includes("--dry-run");

  // Meta topics are the flat sections: no exam domain, and no children.
  const metaTopics = await prisma.topic.findMany({
    where: { parentTopicId: null, examDomain: null },
    include: { certification: true },
    orderBy: { orderIndex: "asc" },
  });

  let written = 0;
  let unchanged = 0;
  let missing = 0;

  for (const topic of metaTopics) {
    const normal = await prisma.topicContent.findUnique({
      where: { topicId_mode_locale: { topicId: topic.id, mode: "normal", locale } },
    });
    if (!normal) {
      console.log(`  MISSING  ${topic.certification.code} ${topic.title} - no ${locale} normal row`);
      missing++;
      continue;
    }

    const existing = await prisma.topicContent.findUnique({
      where: { topicId_mode_locale: { topicId: topic.id, mode: "in_depth", locale } },
    });
    if (existing?.contentMd === normal.contentMd) {
      unchanged++;
      continue;
    }

    if (!dryRun) {
      await prisma.topicContent.upsert({
        where: { topicId_mode_locale: { topicId: topic.id, mode: "in_depth", locale } },
        create: {
          topicId: topic.id,
          mode: "in_depth",
          locale,
          contentMd: normal.contentMd,
        },
        update: { contentMd: normal.contentMd },
      });
    }
    console.log(`  ${existing ? "updated" : "created"}  ${topic.certification.code} ${topic.title}`);
    written++;
  }

  console.log(
    `\n${metaTopics.length} meta topic(s): ${written} written, ${unchanged} already matching` +
      (missing ? `, ${missing} with no ${locale} normal row yet` : "") +
      (dryRun ? " [dry run]" : "")
  );
  if (missing) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
  await prisma.$disconnect();
});
