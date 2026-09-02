/**
 * Reports which topics still lack real in-depth content, and gates a domain
 * as "done".
 *
 * When the in-depth wizard was introduced, `normal` absorbed the old in-depth
 * text and only three topics were re-authored as wizard walkthroughs - the
 * other 86 in_depth rows are byte-for-byte copies of their normal row, so the
 * mode looks populated while delivering nothing extra. A copy is invisible in
 * any "is content present?" check, which is why this compares digests instead.
 *
 * Not part of any Lambda runtime path. Usage:
 *   npm run content:check                                  # every domain
 *   npm run content:check -- --cert CCAR-F --domain D1      # one domain
 *   npm run content:check -- --verbose | --json
 *
 * Exits 1 if any topic in scope is not OK, so a single command answers
 * "is this domain finished?".
 */
import { createHash } from "node:crypto";
import { lintInDepth } from "@claude-cert/shared";
import { prisma } from "../src/client";

type Status = "OK" | "IDENTICAL" | "MISSING" | "NONCONFORMING";

interface Row {
  cert: string;
  domain: string;
  subtopic: string;
  title: string;
  status: Status;
  chars: number;
  steps: number;
  detail: string;
}

const EXPLANATION: Record<Status, string> = {
  OK: "conforms to the in-depth contract",
  IDENTICAL: "in_depth is a byte-for-byte copy of normal - no extra depth",
  MISSING: "no in_depth row at all",
  NONCONFORMING: "distinct content, but fails the in-depth contract",
};

function digest(text: string): string {
  return createHash("md5").update(text.replace(/\r\n/g, "\n").trim()).digest("hex");
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const certFilter = flag("cert")?.toUpperCase();
  const domainFilter = flag("domain")?.toUpperCase();
  const verbose = argv.includes("--verbose");
  const asJson = argv.includes("--json");

  const certifications = await prisma.certification.findMany({
    where: certFilter ? { code: certFilter } : {},
    orderBy: { code: "asc" },
  });
  if (certifications.length === 0) throw new Error(`No certification matches ${certFilter}`);

  const rows: Row[] = [];

  for (const certification of certifications) {
    const topics = await prisma.topic.findMany({
      where: { certificationId: certification.id },
      orderBy: { orderIndex: "asc" },
    });
    const content = await prisma.topicContent.findMany({
      where: { topicId: { in: topics.map((t) => t.id) } },
    });
    const byTopicMode = new Map(content.map((c) => [`${c.topicId}:${c.mode}`, c.contentMd]));
    const parentById = new Map(topics.map((t) => [t.id, t]));

    for (const topic of topics) {
      const parent = topic.parentTopicId ? parentById.get(topic.parentTopicId) : undefined;
      const domain = topic.examDomain ?? parent?.examDomain ?? "-";
      if (domainFilter && domain !== domainFilter) continue;

      const inDepth = byTopicMode.get(`${topic.id}:in_depth`);
      const normal = byTopicMode.get(`${topic.id}:normal`);

      const domainNumber = domain.replace(/\D/g, "");
      const subtopic = topic.parentTopicId
        ? `${domainNumber || "?"}.${topic.orderIndex}`
        : "overview";

      let status: Status;
      let detail = "";
      let steps = 0;

      if (!inDepth) {
        status = "MISSING";
      } else if (normal && digest(inDepth) === digest(normal)) {
        status = "IDENTICAL";
      } else {
        const lint = lintInDepth(inDepth);
        steps = lint.steps.length;
        if (lint.errors.length > 0) {
          status = "NONCONFORMING";
          detail = lint.errors.join("; ");
        } else {
          status = "OK";
          detail = lint.warnings.join("; ");
        }
      }

      rows.push({
        cert: certification.code,
        domain,
        subtopic,
        title: topic.title,
        status,
        chars: inDepth?.length ?? 0,
        steps,
        detail,
      });
    }
  }

  // Topics come back in orderIndex order, which interleaves domains (a
  // domain's own row sits between other domains' subtopics). Group them so
  // the per-domain rollup reads as a scoreboard.
  const subtopicRank = (s: string) =>
    s === "overview" ? -1 : Number(s.split(".")[1] ?? 0);
  rows.sort(
    (a, b) =>
      a.cert.localeCompare(b.cert) ||
      // Non-domain sections ("-") sort after the numbered domains.
      (a.domain === "-" ? 1 : 0) - (b.domain === "-" ? 1 : 0) ||
      a.domain.localeCompare(b.domain) ||
      subtopicRank(a.subtopic) - subtopicRank(b.subtopic)
  );

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    let currentGroup = "";
    for (const row of rows) {
      const group = `${row.cert} ${row.domain}`;
      if (group !== currentGroup) {
        const inGroup = rows.filter((r) => `${r.cert} ${r.domain}` === group);
        const ok = inGroup.filter((r) => r.status === "OK").length;
        console.log(`\n${group}  —  ${ok}/${inGroup.length} OK`);
        currentGroup = group;
      }
      const mark = row.status === "OK" ? "✓" : "✗";
      console.log(
        `  ${mark} ${row.subtopic.padEnd(8)} ${row.status.padEnd(14)} ` +
          `${row.steps ? `${row.steps} steps, ` : ""}${row.chars} chars  ${row.title}`
      );
      if (verbose && row.detail) console.log(`      ${row.detail}`);
    }

    console.log("\nSummary");
    for (const status of ["OK", "NONCONFORMING", "IDENTICAL", "MISSING"] as Status[]) {
      const n = rows.filter((r) => r.status === status).length;
      if (n > 0) console.log(`  ${String(n).padStart(3)} ${status.padEnd(14)} ${EXPLANATION[status]}`);
    }
    console.log(`  ${String(rows.length).padStart(3)} topics in scope`);
  }

  if (rows.some((r) => r.status !== "OK")) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
