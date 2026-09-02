/**
 * Ingests hand-authored course content from `content/` into `topic_content`.
 *
 * Replaces the earlier ingest-content-variants.ts, which keyed rows off topic
 * UUIDs. Those are `@default(uuid())`, so a UUID-keyed file only works against
 * the one database that generated them - useless for content we want committed
 * and reviewable. This script resolves topics by
 * (certification code, exam domain, subtopic index) instead, all of which are
 * derived deterministically from the source guides by migrate-guides.ts, so
 * the same file ingests correctly into any environment.
 *
 * Not part of any Lambda runtime path. Usage:
 *   npm run content:ingest -- content/in-depth/ccar-f/d1
 *   npm run content:ingest -- content/in-depth/ccar-f/d1/1.1-agentic-loop.md --dry-run
 *
 * Files and directories both work (directories recurse, and basenames
 * starting with "_" are skipped so _TEMPLATE.md isn't ingested). Idempotent:
 * content that already matches the stored row is reported `unchanged` and not
 * rewritten, so `updated_at` keeps meaning "when the text last changed".
 *
 * Flags: --dry-run (resolve + lint, write nothing), --force (write despite
 * lint errors), --verbose (per-step word/code/diagram counts).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { lintInDepth } from "@claude-cert/shared";
import { prisma } from "../src/client";

const REPO_ROOT = resolve(__dirname, "../../..");

type Mode = "in_depth" | "normal" | "concise";
const MODES: Mode[] = ["in_depth", "normal", "concise"];
const FRONT_MATTER_KEYS = ["cert", "domain", "subtopic", "mode", "title"] as const;

interface FrontMatter {
  cert: string;
  domain?: string;
  /** "1.3" for a subtopic, "overview" (or absent) for the domain topic itself. */
  subtopic?: string;
  mode: Mode;
  title?: string;
}

interface ParsedFile {
  path: string;
  frontMatter: FrontMatter;
  contentMd: string;
}

class ContentError extends Error {}

function parseFrontMatter(path: string, raw: string): ParsedFile {
  // Normalize CRLF up front: the wizard splits steps on "\n", so a stray
  // carriage return would end up inside every step title.
  const text = raw.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) throw new ContentError("missing `---` front matter block at the top of the file");

  const fields = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (!kv) throw new ContentError(`front matter line is not \`key: value\`: ${line}`);
    const key = kv[1];
    if (!(FRONT_MATTER_KEYS as readonly string[]).includes(key)) {
      throw new ContentError(`unknown front matter key "${key}"`);
    }
    fields.set(key, kv[2].trim());
  }

  const cert = fields.get("cert");
  const mode = fields.get("mode") as Mode | undefined;
  if (!cert) throw new ContentError("front matter is missing `cert`");
  if (!mode) throw new ContentError("front matter is missing `mode`");
  if (!MODES.includes(mode)) throw new ContentError(`\`mode\` must be one of ${MODES.join(", ")}`);

  const contentMd = text.slice(match[0].length).trim() + "\n";
  if (!contentMd.trim()) throw new ContentError("file has front matter but no content");

  return {
    path,
    frontMatter: {
      cert: cert.toUpperCase(),
      domain: fields.get("domain")?.toUpperCase(),
      subtopic: fields.get("subtopic"),
      mode,
      title: fields.get("title"),
    },
    contentMd,
  };
}

/** Dash- and whitespace-insensitive comparison, for the title checksum. */
function normalizeTitle(title: string): string {
  return title
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function resolveTopicId(fm: FrontMatter): Promise<{ id: string; title: string }> {
  const certification = await prisma.certification.findUnique({ where: { code: fm.cert } });
  if (!certification) throw new ContentError(`unknown certification code "${fm.cert}"`);

  const isOverview = !fm.subtopic || fm.subtopic === "overview";

  if (!fm.domain) {
    throw new ContentError("front matter needs `domain` (e.g. D1) to resolve a topic");
  }

  const roots = await prisma.topic.findMany({
    where: { certificationId: certification.id, parentTopicId: null, examDomain: fm.domain },
  });
  if (roots.length === 0) {
    throw new ContentError(`no ${fm.cert} topic with exam domain ${fm.domain}`);
  }
  if (roots.length > 1) {
    throw new ContentError(`${roots.length} ${fm.cert} topics share exam domain ${fm.domain}`);
  }
  const root = roots[0];

  if (isOverview) return { id: root.id, title: root.title };

  // migrate-guides.ts sets a subtopic's orderIndex from the minor number of
  // its "N.M Title" heading, so "1.3" resolves to orderIndex 3 under D1.
  const parts = /^(\d+)\.(\d+)$/.exec(fm.subtopic!);
  if (!parts) {
    throw new ContentError(`\`subtopic\` must be "N.M" or "overview", got "${fm.subtopic}"`);
  }
  const domainNumber = Number(fm.domain.replace(/\D/g, ""));
  if (Number(parts[1]) !== domainNumber) {
    throw new ContentError(`\`subtopic: ${fm.subtopic}\` does not belong to domain ${fm.domain}`);
  }

  const children = await prisma.topic.findMany({
    where: { parentTopicId: root.id, orderIndex: Number(parts[2]) },
  });
  if (children.length === 0) {
    throw new ContentError(`${fm.cert} ${fm.domain} has no subtopic ${fm.subtopic}`);
  }
  if (children.length > 1) {
    throw new ContentError(`${children.length} subtopics share index ${fm.subtopic}`);
  }
  return { id: children[0].id, title: children[0].title };
}

function collectFiles(target: string): string[] {
  const stat = statSync(target);
  if (stat.isFile()) return [target];
  return readdirSync(target)
    .filter((name) => !name.startsWith("_"))
    .flatMap((name) => {
      const child = join(target, name);
      if (statSync(child).isDirectory()) return collectFiles(child);
      return extname(name) === ".md" && basename(name) !== "AUTHORING.md" ? [child] : [];
    })
    .sort();
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const verbose = argv.includes("--verbose");
  const targets = argv.filter((a) => !a.startsWith("--"));

  if (targets.length === 0) {
    console.error("Usage: npm run content:ingest -- <file-or-dir>... [--dry-run] [--force] [--verbose]");
    process.exitCode = 1;
    return;
  }

  const files = targets.flatMap((t) => collectFiles(resolve(t)));
  const counts = { created: 0, updated: 0, unchanged: 0, error: 0 };

  for (const file of files) {
    const label = relative(REPO_ROOT, file).replace(/\\/g, "/");
    try {
      const parsed = parseFrontMatter(file, readFileSync(file, "utf8"));
      const topic = await resolveTopicId(parsed.frontMatter);

      // The title is a checksum, not a key - a mismatch usually means the
      // guide was re-worded, which is worth knowing but shouldn't block.
      if (
        parsed.frontMatter.title &&
        normalizeTitle(parsed.frontMatter.title) !== normalizeTitle(topic.title)
      ) {
        console.log(`  ! title drift: file says "${parsed.frontMatter.title}", db has "${topic.title}"`);
      }

      let blocked = false;
      if (parsed.frontMatter.mode === "in_depth") {
        const lint = lintInDepth(parsed.contentMd);
        for (const err of lint.errors) console.log(`  ✗ ${err}`);
        for (const warn of lint.warnings) console.log(`  ⚠ ${warn}`);
        if (verbose) {
          lint.steps.forEach((s, i) => {
            console.log(
              `    ${i + 1}. ${s.title} — ${s.words}w, ${s.codeBlocks} code, ${s.diagrams} diagram`
            );
          });
          console.log(`    total: ${lint.totalWords} words`);
        }
        blocked = lint.errors.length > 0 && !force;
      }

      if (blocked) {
        console.log(`${label}: error (lint - re-run with --force to write anyway)`);
        counts.error++;
        continue;
      }

      const existing = await prisma.topicContent.findUnique({
        where: { topicId_mode: { topicId: topic.id, mode: parsed.frontMatter.mode } },
      });

      if (existing && existing.contentMd === parsed.contentMd) {
        console.log(`${label}: unchanged (${topic.title})`);
        counts.unchanged++;
        continue;
      }

      if (dryRun) {
        console.log(`${label}: would ${existing ? "update" : "create"} (${topic.title})`);
        existing ? counts.updated++ : counts.created++;
        continue;
      }

      await prisma.topicContent.upsert({
        where: { topicId_mode: { topicId: topic.id, mode: parsed.frontMatter.mode } },
        update: { contentMd: parsed.contentMd },
        create: { topicId: topic.id, mode: parsed.frontMatter.mode, contentMd: parsed.contentMd },
      });
      console.log(`${label}: ${existing ? "updated" : "created"} (${topic.title})`);
      existing ? counts.updated++ : counts.created++;
    } catch (err) {
      console.log(`${label}: error - ${err instanceof Error ? err.message : err}`);
      counts.error++;
    }
  }

  console.log(
    `\n${files.length} file(s): ${counts.created} created, ${counts.updated} updated, ` +
      `${counts.unchanged} unchanged, ${counts.error} error${dryRun ? "  [dry run]" : ""}`
  );
  if (counts.error > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
