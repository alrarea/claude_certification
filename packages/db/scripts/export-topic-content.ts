/**
 * Dumps `topic_content` rows out to markdown files with the front matter that
 * `ingest-topic-content.ts` expects, so a mode's content can round-trip.
 *
 * Two reasons this exists:
 *  - The database is the only copy of the original hand-authored in_depth
 *    rows (they were written straight to the DB, the authoring files were
 *    never committed). Export them before an ingest overwrites them.
 *  - When authoring in-depth content, `--mode normal` gives you the existing
 *    explanation for the same topic - the thing in-depth must not simply
 *    restate.
 *
 * Not part of any Lambda runtime path. Usage:
 *   npm run content:export -- --cert CCAR-F --domain D1 --mode in_depth --out ../dump
 *
 * Write somewhere outside the repo (or under .content-export/, which is
 * gitignored) - these are reference dumps, not the source of truth.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/client";

type Mode = "in_depth" | "normal" | "concise";
const MODES: Mode[] = ["in_depth", "normal", "concise"];

interface Args {
  cert: string;
  domain?: string;
  mode: Mode;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) throw new Error(`Unexpected argument: ${argv[i]}`);
    flags.set(argv[i].slice(2), argv[i + 1] ?? "");
  }
  const cert = flags.get("cert");
  const mode = (flags.get("mode") ?? "normal") as Mode;
  const out = flags.get("out");
  if (!cert) throw new Error("--cert is required (e.g. --cert CCAR-F)");
  if (!out) throw new Error("--out <dir> is required");
  if (!MODES.includes(mode)) throw new Error(`--mode must be one of ${MODES.join(", ")}`);
  return { cert: cert.toUpperCase(), domain: flags.get("domain")?.toUpperCase(), mode, out };
}

/** "The Agentic Loop — The Core of Everything" -> "the-agentic-loop-the-core-of-everything" */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‐-―]/g, "-") // hyphen/en/em dashes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(.{0,48})(-.*)?$/s, "$1"); // cut on a word boundary
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const certification = await prisma.certification.findUniqueOrThrow({
    where: { code: args.cert },
  });

  const roots = await prisma.topic.findMany({
    where: {
      certificationId: certification.id,
      parentTopicId: null,
      ...(args.domain ? { examDomain: args.domain } : {}),
    },
    orderBy: { orderIndex: "asc" },
  });

  let written = 0;
  let skipped = 0;

  for (const root of roots) {
    // Only domain sections have the "N.M" subtopic numbering the ingest keys
    // off, so a flat section (overview, quickref, ...) exports as itself only.
    const domainNumber = root.examDomain ? Number(root.examDomain.replace(/\D/g, "")) : null;
    const children = await prisma.topic.findMany({
      where: { parentTopicId: root.id },
      orderBy: { orderIndex: "asc" },
    });

    const targets = [
      { topic: root, subtopic: "overview" },
      ...children.map((child) => ({
        topic: child,
        subtopic: domainNumber ? `${domainNumber}.${child.orderIndex}` : String(child.orderIndex),
      })),
    ];

    for (const { topic, subtopic } of targets) {
      const content = await prisma.topicContent.findUnique({
        where: { topicId_mode: { topicId: topic.id, mode: args.mode } },
      });
      if (!content) {
        skipped++;
        continue;
      }

      const dir = resolve(
        args.out,
        certification.code.toLowerCase(),
        (root.examDomain ?? slugify(root.title)).toLowerCase()
      );
      mkdirSync(dir, { recursive: true });

      const base =
        subtopic === "overview" ? "overview" : `${subtopic}-${slugify(topic.title)}`;
      const frontMatter = [
        "---",
        `cert: ${certification.code}`,
        ...(root.examDomain ? [`domain: ${root.examDomain}`] : []),
        `subtopic: ${subtopic}`,
        `mode: ${args.mode}`,
        `title: ${topic.title}`,
        "---",
        "",
      ].join("\n");

      writeFileSync(
        resolve(dir, `${base}.md`),
        frontMatter + content.contentMd.replace(/\r\n/g, "\n").trimEnd() + "\n",
        "utf8"
      );
      console.log(`  ${base}.md  (${content.contentMd.length} chars)`);
      written++;
    }
  }

  console.log(
    `\n${args.cert}${args.domain ? ` ${args.domain}` : ""} mode=${args.mode}: ` +
      `${written} file(s) written to ${resolve(args.out)}, ${skipped} topic(s) had no content`
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
