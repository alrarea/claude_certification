/**
 * Reports which topics still lack real in-depth content, and gates a domain
 * as "done".
 *
 * When the in-depth wizard was introduced, `normal` absorbed the old in-depth
 * text and only three topics were re-authored as wizard walkthroughs - the
 * rest were byte-for-byte copies of their normal row, so the mode looked
 * populated while delivering nothing extra. A copy is invisible in any "is
 * content present?" check, which is why this compares digests instead.
 *
 * Topics with no exam domain - registration, policies, sample questions,
 * revision checklists - are exempt. They are exam logistics, not subject
 * matter: there is no problem to solve, no implementation and no failure mode,
 * so the nine-step contract has nothing to attach to. They report as META and
 * do not fail the run. Serving the normal text in both modes is the intended
 * behaviour for them, not an unfinished task.
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
import {
  DEFAULT_LOCALE,
  LOCALES,
  lintInDepth,
  parseLocale,
} from "@claude-cert/shared";
import { prisma } from "../src/client";

type Status = "OK" | "META" | "UNTRANSLATED" | "IDENTICAL" | "MISSING" | "NONCONFORMING";

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
  META: "exam logistics, not subject matter - exempt from the contract",
  UNTRANSLATED: "no row in this locale yet - expected while a translation is in progress",
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
  const locale = parseLocale(flag("locale") ?? DEFAULT_LOCALE);
  if (!locale) throw new Error(`--locale must be one of ${LOCALES.join(", ")}`);
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
    // Keyed by locale as well, so a translation is only ever compared against
    // its own language. Comparing an ml in_depth row to an en normal row would
    // call every translated topic "distinct" for the wrong reason.
    const byTopicMode = new Map(
      content.map((c) => [`${c.topicId}:${c.mode}:${c.locale}`, c.contentMd])
    );
    const parentById = new Map(topics.map((t) => [t.id, t]));

    for (const topic of topics) {
      const parent = topic.parentTopicId ? parentById.get(topic.parentTopicId) : undefined;
      const domain = topic.examDomain ?? parent?.examDomain ?? "-";
      if (domainFilter && domain !== domainFilter) continue;

      const inDepth = byTopicMode.get(`${topic.id}:in_depth:${locale}`);
      const normal = byTopicMode.get(`${topic.id}:normal:${locale}`);

      const domainNumber = domain.replace(/\D/g, "");
      const subtopic = topic.parentTopicId
        ? `${domainNumber || "?"}.${topic.orderIndex}`
        : "overview";

      let status: Status;
      let detail = "";
      let steps = 0;

      if (!inDepth && locale !== DEFAULT_LOCALE) {
        // Absent translations are the normal state mid-pass, not a fault. The
        // API falls back to English for these, so nothing renders empty.
        status = "UNTRANSLATED";
      } else if (!inDepth) {
        // Still a real fault for a meta topic: the mode would render empty.
        status = "MISSING";
      } else if (domain === "-") {
        status = "META";
        detail =
          normal && digest(inDepth) === digest(normal)
            ? "serves the normal text in both modes, by design"
            : "distinct from normal, but not held to the contract";
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
        const tally = inGroup.every((r) => r.status === "META")
          ? `${inGroup.length} meta, exempt`
          : inGroup.every((r) => r.status === "UNTRANSLATED")
            ? `${inGroup.length} not translated yet`
            : `${ok}/${inGroup.length} OK`;
        console.log(`\n${group}  —  ${tally}`);
        currentGroup = group;
      }
      const mark =
        row.status === "OK"
          ? "✓"
          : row.status === "META" || row.status === "UNTRANSLATED"
            ? "·"
            : "✗";
      console.log(
        `  ${mark} ${row.subtopic.padEnd(8)} ${row.status.padEnd(14)} ` +
          `${row.steps ? `${row.steps} steps, ` : ""}${row.chars} chars  ${row.title}`
      );
      if (verbose && row.detail) console.log(`      ${row.detail}`);
    }

    console.log("\nSummary");
    const order: Status[] = [
      "OK", "META", "UNTRANSLATED", "NONCONFORMING", "IDENTICAL", "MISSING",
    ];
    for (const status of order) {
      const n = rows.filter((r) => r.status === status).length;
      if (n > 0) console.log(`  ${String(n).padStart(3)} ${status.padEnd(14)} ${EXPLANATION[status]}`);
    }
    console.log(`  ${String(rows.length).padStart(3)} topics in scope`);
  }

  // UNTRANSLATED only counts against the run when a specific slice was named -
  // "is this domain's translation finished?" is a fair question to fail on,
  // "is the whole corpus translated?" is not, while a pass is still under way.
  const gatingASlice = Boolean(certFilter || domainFilter);
  const failing = rows.filter(
    (r) =>
      r.status !== "OK" &&
      r.status !== "META" &&
      !(r.status === "UNTRANSLATED" && !gatingASlice)
  );
  if (failing.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
