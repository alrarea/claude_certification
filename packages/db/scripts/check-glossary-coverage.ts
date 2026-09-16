/**
 * Reports English terms left standing in translated prose that the glossary
 * cannot explain.
 *
 * Terms stay in English on purpose - the exam is in English, so a learner who
 * only ever met a Malayalam coinage for `stop_reason` would not recognise the
 * real thing on exam day. That bargain only holds while the meaning is one
 * hover away. A term the glossary has never heard of is the bargain broken:
 * an English word sitting in Malayalam prose with nothing behind it.
 *
 * `findUnglossedLatinRuns` has existed since the glossary landed but nothing
 * ever called it - fine while one domain was translated by hand, useless as a
 * safety net across a whole corpus. This is the runner.
 *
 * Not every run it finds needs an entry. Proper nouns (Claude, AWS, Anthropic)
 * and code identifiers are expected to stand alone, so the report ranks by how
 * many topics a run appears in: a term used in thirty topics and defined in
 * none is the signal, a one-off is usually a name.
 *
 * Not part of any Lambda runtime path. Usage:
 *   npm run content:glossary                       # every translated locale
 *   npm run content:glossary -- --locale ml --min 3
 *   npm run content:glossary -- --dir content/ml/normal
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import {
  DEFAULT_LOCALE,
  GLOSSARY,
  LOCALES,
  findUnglossedLatinRuns,
  parseLocale,
} from "@claude-cert/shared";

/** Runs that are never glossary candidates: they are names, not vocabulary. */
const EXPECTED_BARE = new Set(
  [
    "Claude",
    "Claude Code",
    "Anthropic",
    "AWS",
    "API",
    "CCAR-F",
    "CCAR-P",
    "JSON",
    "YAML",
    "SDK",
    "CLI",
    "URL",
    "HTTP",
    "HTTPS",
    "PDF",
    "S3",
    "IAM",
  ].map((s) => s.toLowerCase())
);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (extname(full) === ".md") out.push(full);
  }
  return out;
}

/** Strips what the reader never sees as prose, so code is not read as vocabulary. */
function proseOnly(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const locale = parseLocale(flag("locale") ?? "ml");
  if (!locale) throw new Error(`--locale must be one of ${LOCALES.join(", ")}`);
  if (locale === DEFAULT_LOCALE) throw new Error("only a translated locale has unglossed runs");
  const min = Number(flag("min") ?? "2");
  const root = flag("dir") ?? `content/${locale}`;

  const files = walk(root);
  if (files.length === 0) throw new Error(`no markdown under ${root}`);

  // Topics per run, not occurrences: a term repeated eight times in one page
  // is one gap, and a term used once each across eight pages is eight.
  const topics = new Map<string, Set<string>>();
  for (const file of files) {
    const text = proseOnly(readFileSync(file, "utf8"));
    for (const run of findUnglossedLatinRuns(text)) {
      // A run ends up with the hyphen that joins it to a Malayalam suffix
      // ("Claude-ന്റെ" scans as "Claude-"); the word is what matters here.
      const key = run.trim().replace(/[-.]+$/, "");
      if (!key || EXPECTED_BARE.has(key.toLowerCase())) continue;
      if (!/[A-Za-z]{3}/.test(key)) continue;
      const seen = topics.get(key) ?? new Set<string>();
      seen.add(file);
      topics.set(key, seen);
    }
  }

  const ranked = [...topics.entries()]
    .map(([run, seen]) => ({ run, topics: seen.size, example: basename([...seen][0]) }))
    .filter((r) => r.topics >= min)
    .sort((a, b) => b.topics - a.topics || a.run.localeCompare(b.run));

  console.log(`${files.length} translated file(s) under ${root}, glossary has ${GLOSSARY.length} terms\n`);
  if (ranked.length === 0) {
    console.log(`no English run appears unglossed in ${min}+ topics`);
    return;
  }
  console.log(`English runs with no glossary entry, in ${min}+ topics:\n`);
  for (const r of ranked) {
    console.log(`  ${String(r.topics).padStart(4)}  ${r.run}${r.topics === 1 ? ` (${r.example})` : ""}`);
  }
  console.log(
    `\n${ranked.length} candidate(s). Add the ones that are vocabulary to ` +
      `packages/shared/src/glossary.ts; the rest are names and need nothing.`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
