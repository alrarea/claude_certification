/**
 * Translates topic markdown into another locale without letting the structure
 * move.
 *
 * The risk in translating this corpus is not word choice, it is that a model
 * handed a whole document hands back a slightly different document: a table
 * row with four cells instead of three, a heading reworded so the nine-step
 * lint rejects it, a code sample "helpfully" localised. So the model never
 * sees a document. The harness splits the file into segments, sends only the
 * prose ones, and reassembles deterministically from the original skeleton.
 *
 * What never reaches the translator:
 *   - fenced code blocks, byte for byte (identifiers and output are English)
 *   - inline `code` spans and URLs, swapped for placeholders first
 *   - the nine step headings and the callout labels, substituted from fixed
 *     tables so they are identical across every topic in the locale
 *
 * Usage:
 *   npm run content:translate -- <files...> --to ml --out content/ml
 *   ... --base <dir>      the input tree's root: the output mirrors each
 *                         file's path below it (default `content`, so an
 *                         export dump must pass its own).
 *   ... --concurrency N   files translated at once (default 4).
 *   ... --skip-existing   leave files that already exist in the output tree
 *                         alone, so an interrupted corpus run resumes instead
 *                         of paying to translate the same pages twice.
 *   ... --segments-out <f>  write each file's masked segments to JSON and
 *                         stop, so a translator other than the Anthropic
 *                         client can do the language half.
 *   ... --segments-in <f>   read that JSON back with the text translated and
 *                         reassemble from it. Needs no API key, and runs every
 *                         integrity check the API path runs.
 *   ... --dry-run         no API call: translates by marking text, and still
 *                         runs every integrity check, so the structural half
 *                         of the pipeline can be proven without spending
 *                         anything.
 *
 * Needs ANTHROPIC_API_KEY for a real run. Exits 1 if any integrity check fails.
 */
// Same convention as `src/client.ts`: secrets come from the gitignored root
// `.env`, so ANTHROPIC_API_KEY does not have to be exported into the shell.
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  IN_DEPTH_STEPS,
  IN_DEPTH_STEPS_ML,
  LOCALES,
  lintInDepth,
  parseLocale,
  type Locale,
} from "@claude-cert/shared";

const MODEL = "claude-opus-5";

/**
 * Medium rather than the default high. The task is mechanical and fully
 * specified - the rules are in the system prompt and the structure never
 * reaches the model - so the depth of deliberation buys far less here than the
 * model's own command of the language does, and this runs a few hundred times.
 */
const EFFORT = "medium" as const;

/** Callout labels, keyed by the emoji, which is the locale-independent part. */
const CALLOUT_LABELS: Record<string, Record<Locale, string>> = {
  "🗣": { en: "In plain English", ml: "ലളിതമായി പറഞ്ഞാൽ" },
  "💡": { en: "Tip", ml: "നുറുങ്ങ്" },
  "⚠": { en: "Watch out", ml: "ശ്രദ്ധിക്കുക" },
  "🔑": { en: "Key takeaway", ml: "പ്രധാന നിഗമനം" },
  "📝": { en: "Exam focus", ml: "പരീക്ഷാ ശ്രദ്ധ" },
  "🌍": { en: "Real-world example", ml: "യഥാർഥ ഉദാഹരണം" },
  "🚫": { en: "Out of scope", ml: "പരിധിക്ക് പുറത്ത്" },
};

type Piece =
  | { kind: "verbatim"; text: string }
  | { kind: "heading"; hashes: string; text: string; id?: number }
  | { kind: "tablerow"; lead: string; cells: string[]; ids: number[] }
  | { kind: "prose"; text: string; id: number };

interface Segment {
  id: number;
  text: string;
}

/** A table divider row (|---|---|) carries structure, never words. */
const isDivider = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);
const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);

/**
 * Hide anything that must survive translation byte-for-byte, so the model
 * cannot rewrite an identifier or a URL even if it wants to.
 */
function protect(text: string): { masked: string; restore: (s: string) => string } {
  const held: string[] = [];
  const stash = (m: string) => {
    held.push(m);
    return `⟦${held.length - 1}⟧`;
  };
  const masked = text
    .replace(/`[^`]+`/g, stash)
    .replace(/https?:\/\/\S+/g, stash);
  return {
    masked,
    restore: (s: string) =>
      s.replace(/⟦(\d+)⟧/g, (_, i) => held[Number(i)] ?? ""),
  };
}

function splitPieces(body: string, from: Locale, to: Locale) {
  const lines = body.split("\n");
  const pieces: Piece[] = [];
  const segments: Segment[] = [];
  let nextId = 0;
  const addSegment = (text: string) => {
    segments.push({ id: nextId, text });
    return nextId++;
  };

  const stepsFrom = from === "ml" ? IN_DEPTH_STEPS_ML : IN_DEPTH_STEPS;
  const stepsTo = to === "ml" ? IN_DEPTH_STEPS_ML : IN_DEPTH_STEPS;

  let i = 0;
  let buffer: string[] = [];
  const flushProse = () => {
    const text = buffer.join("\n");
    if (text.trim()) pieces.push({ kind: "prose", text, id: addSegment(text) });
    else if (buffer.length) pieces.push({ kind: "verbatim", text });
    buffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced blocks: copied through untouched, including mermaid. Diagram
    // labels are a separate, quoting-sensitive pass - translating them here
    // would be the fastest way to ship 158 unparseable diagrams.
    if (/^```/.test(line)) {
      flushProse();
      const block = [line];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) block.push(lines[i++]);
      if (i < lines.length) block.push(lines[i++]);
      pieces.push({ kind: "verbatim", text: block.join("\n") });
      continue;
    }

    const heading = /^(#{2,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushProse();
      const [, hashes, text] = heading;
      // A contract step heading is substituted, never translated: the lint
      // compares it for exact equality across every topic in the locale.
      const idx = stepsFrom.findIndex((s) =>
        s.match === "exact" ? text === s.heading : text.startsWith(s.heading)
      );
      if (hashes === "##" && idx !== -1) {
        const spec = stepsFrom[idx];
        if (spec.match === "prefix") {
          const tail = text.slice(spec.heading.length).trim();
          pieces.push({
            kind: "heading",
            hashes,
            text: stepsTo[idx].heading + " ",
            id: addSegment(tail),
          });
        } else {
          pieces.push({ kind: "heading", hashes, text: stepsTo[idx].heading });
        }
      } else {
        pieces.push({ kind: "heading", hashes, text: "", id: addSegment(text) });
      }
      i++;
      continue;
    }

    if (isDivider(line)) {
      flushProse();
      pieces.push({ kind: "verbatim", text: line });
      i++;
      continue;
    }

    if (isTableRow(line)) {
      flushProse();
      // Split on the pipes and translate each cell on its own, so a translated
      // cell containing a comma or a dash can never be read back as an extra
      // column.
      const trimmed = line.trim();
      const inner = trimmed.slice(1, -1);
      const cells = inner.split("|");
      const lead = line.slice(0, line.indexOf("|"));
      pieces.push({
        kind: "tablerow",
        lead,
        cells,
        ids: cells.map((c) => (c.trim() ? addSegment(c.trim()) : -1)),
      });
      i++;
      continue;
    }

    buffer.push(line);
    i++;
  }
  flushProse();
  return { pieces, segments };
}

/** Swap a callout's label for the target locale's wording. */
function localiseCallouts(text: string, to: Locale): string {
  return text.replace(/^(>\s*\*\*)([^*]+)(\*\*)/gm, (whole, open, label, close) => {
    for (const [emoji, names] of Object.entries(CALLOUT_LABELS)) {
      if (label.includes(emoji)) {
        const trailing = label.trimEnd().endsWith(":") ? ":" : "";
        return `${open}${emoji}️ ${names[to]}${trailing}${close}`;
      }
    }
    return whole;
  });
}

function reassemble(pieces: Piece[], translated: Map<number, string>): string {
  const out: string[] = [];
  for (const p of pieces) {
    if (p.kind === "verbatim") out.push(p.text);
    else if (p.kind === "prose") out.push(translated.get(p.id) ?? p.text);
    else if (p.kind === "heading") {
      const tail = p.id === undefined ? "" : (translated.get(p.id) ?? "");
      out.push(`${p.hashes} ${p.text}${tail}`.trimEnd());
    } else {
      const cells = p.cells.map((c, n) => {
        const id = p.ids[n];
        if (id === -1) return c;
        const t = translated.get(id) ?? c.trim();
        return ` ${t} `;
      });
      out.push(`${p.lead}|${cells.join("|")}|`);
    }
  }
  return out.join("\n");
}

const TOOL = {
  name: "return_translations",
  description: "Return every segment translated, one for one.",
  input_schema: {
    type: "object" as const,
    properties: {
      segments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            text: { type: "string" },
          },
          required: ["id", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["segments"],
    additionalProperties: false,
  },
};

async function translateSegments(
  segments: Segment[],
  to: Locale,
  glossaryTerms: string[]
): Promise<Map<number, string>> {
  const client = new Anthropic();
  const system = [
    `Translate technical course material from English into ${to === "ml" ? "Malayalam" : to}.`,
    "",
    "Rules, in order of importance:",
    `1. Leave these technical terms in English exactly as written: ${glossaryTerms.join(", ")}.`,
    "   Also leave any code identifier, API field name, model id or file path in English.",
    "2. A token like ⟦0⟧ is a placeholder for code or a URL. Reproduce it exactly,",
    "   once, in a natural position. Never translate, renumber or drop one.",
    "3. Translate meaning, not words. The reader is learning; clarity beats literalness.",
    "4. Return one translation per input id. Never merge, split, reorder or omit segments.",
    "5. Keep markdown emphasis (**bold**, *italic*) around the same idea it marked.",
  ].join("\n");

  const out = new Map<number, string>();
  // Batches of segments rather than whole documents, so one bad response
  // cannot corrupt a file - and small enough that a retry is cheap. 25 rather
  // than 40 because Malayalam costs far more output tokens per character than
  // the English it replaces, and a chunk that runs into max_tokens comes back
  // as truncated tool JSON - which reads as "segments missing from the
  // response", i.e. a whole file failed for a reason that looks like anything
  // but the real one.
  const CHUNK = 25;
  for (let i = 0; i < segments.length; i += CHUNK) {
    const chunk = segments.slice(i, i + CHUNK);
    const translated = await withRetry(async () => {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: EFFORT },
        system,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: JSON.stringify({ segments: chunk }) }],
      });
      if (res.stop_reason === "max_tokens") {
        throw new Error("response hit max_tokens - tool JSON is truncated");
      }
      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("model returned no tool_use");
      return (block.input as { segments: Segment[] }).segments;
    });
    for (const s of translated) out.set(s.id, s.text);
  }
  return out;
}

/**
 * One retry is the right number here. A 429 or an overloaded 529 clears on its
 * own; a truncated response usually re-rolls shorter. Anything that fails
 * twice is a real problem with the segment, and the integrity checks downstream
 * will name the file rather than let a half-translated page through.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = (err as { status?: number }).status;
    const retryable = status === undefined || status === 429 || status >= 500;
    if (!retryable) throw err;
    await new Promise((r) => setTimeout(r, 20_000));
    return fn();
  }
}

function parseFrontMatter(text: string) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) throw new Error("no front matter");
  const fields = new Map<string, string>();
  for (const line of m[1].split("\n")) {
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (kv) fields.set(kv[1], kv[2].trim());
  }
  return { fields, body: text.slice(m[0].length) };
}

/** Flags that take a value, so their value is never mistaken for an input file. */
const VALUE_FLAGS = ["to", "out", "base", "concurrency", "segments-out", "segments-in"];
const BOOL_FLAGS = ["dry-run", "skip-existing"];

/** One file's masked segments, as handed to a translator and handed back. */
interface SegmentDump {
  file: string;
  title: string;
  segments: Array<{ id: number; text: string }>;
}

/**
 * Writes the masked segments of each file to JSON and stops, so something
 * other than the Anthropic client can do the translating - this session's own
 * model, a human translator, a different service.
 *
 * The split is pure, so `--segments-in` re-derives the identical skeleton from
 * the same sources and only needs the strings back. Nothing about the
 * integrity guarantees changes: the reassembly, the placeholder accounting,
 * the fenced-block and table-shape comparisons and the contract lint all run
 * exactly as they do on the API path.
 */
function dumpSegments(files: string[], to: Locale, target: string): void {
  const dumps: SegmentDump[] = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const { fields, body } = parseFrontMatter(raw);
    const from = parseLocale(fields.get("locale") ?? "en") ?? "en";
    const { segments } = splitPieces(body, from, to);
    dumps.push({
      file,
      title: fields.get("title") ?? "",
      segments: segments.map((s) => ({ id: s.id, text: protect(s.text).masked })),
    });
  }
  mkdirSync(dirname(resolve(target)), { recursive: true });
  writeFileSync(resolve(target), JSON.stringify(dumps, null, 2) + "\n", "utf8");
  const total = dumps.reduce((n, d) => n + d.segments.length, 0);
  console.log(`${dumps.length} file(s), ${total} segment(s) -> ${target}`);
}

/** Reads back a dump whose `text` fields have been replaced with translations. */
function readSegments(source: string): Map<string, Map<number, string>> {
  const parsed = JSON.parse(readFileSync(resolve(source), "utf8")) as SegmentDump[];
  const out = new Map<string, Map<number, string>>();
  for (const entry of parsed) {
    out.set(entry.file, new Map(entry.segments.map((s) => [s.id, s.text])));
  }
  return out;
}

function parseArgv(argv: string[]) {
  const flags = new Map<string, string>();
  const bools = new Set<string>();
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && BOOL_FLAGS.includes(arg.slice(2))) {
      bools.add(arg.slice(2));
    } else if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (!VALUE_FLAGS.includes(name)) throw new Error(`unknown flag ${arg}`);
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      flags.set(name, value);
    } else {
      files.push(arg);
    }
  }
  return { flags, files, bools };
}

/**
 * Translates one file and returns how many integrity checks it failed, so the
 * caller can run several at once and still get a per-file verdict.
 */
async function translateFile(
  file: string,
  opts: {
    to: Locale;
    outDir: string;
    base: string;
    dryRun: boolean;
    terms: string[];
    supplied?: Map<number, string>;
  }
): Promise<number> {
  const { to, outDir, base, dryRun, terms, supplied } = opts;
  let failures = 0;
  {
    const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const { fields, body } = parseFrontMatter(raw);
    const from = parseLocale(fields.get("locale") ?? "en") ?? "en";
    const { pieces, segments } = splitPieces(body, from, to);

    const masked = segments.map((s) => {
      const p = protect(s.text);
      return { seg: { id: s.id, text: p.masked }, restore: p.restore };
    });

    let translated: Map<number, string>;
    if (supplied) {
      // Segments translated outside this process - see --segments-out. The
      // split is pure, so re-running it here reproduces the same ids the dump
      // was keyed by, and every check below still applies.
      translated = supplied;
    } else if (dryRun) {
      // Identity plus a marker: proves the skeleton survives a round trip
      // without spending anything. Every integrity check still runs.
      translated = new Map(masked.map((m) => [m.seg.id, m.seg.text]));
    } else {
      translated = await translateSegments(
        masked.map((m) => m.seg),
        to,
        terms
      );
    }

    // Restore placeholders, and check every one came back exactly once.
    const restored = new Map<number, string>();
    for (const m of masked) {
      const t = translated.get(m.seg.id);
      if (t === undefined) {
        console.log(`${file}: segment ${m.seg.id} missing from the response`);
        failures++;
        continue;
      }
      const wanted = [...m.seg.text.matchAll(/⟦(\d+)⟧/g)].map((x) => x[1]).sort();
      const got = [...t.matchAll(/⟦(\d+)⟧/g)].map((x) => x[1]).sort();
      if (wanted.join() !== got.join()) {
        console.log(
          `${file}: segment ${m.seg.id} placeholder mismatch - ` +
            `expected [${wanted}], got [${got}]`
        );
        failures++;
      }
      restored.set(m.seg.id, m.restore(t));
    }

    let outBody = reassemble(pieces, restored);
    outBody = localiseCallouts(outBody, to);

    // Structural checks against the source.
    const fenceOf = (s: string) => s.match(/```[\s\S]*?```/g) ?? [];
    if (fenceOf(body).join("\n") !== fenceOf(outBody).join("\n")) {
      console.log(`${file}: a fenced block changed - code must be byte-identical`);
      failures++;
    }
    const rowShape = (s: string) =>
      s.split("\n").filter(isTableRow).map((l) => l.split("|").length).join(",");
    if (rowShape(body) !== rowShape(outBody)) {
      console.log(`${file}: table shape changed`);
      failures++;
    }
    if (fields.get("mode") === "in_depth") {
      const lint = lintInDepth(outBody, to);
      if (lint.errors.length) {
        console.log(`${file}: contract errors - ${lint.errors.join("; ")}`);
        failures++;
      }
    }

    const front = ["---"];
    for (const [k, v] of fields) front.push(`${k}: ${k === "locale" ? to : v}`);
    if (!fields.has("locale")) front.push(`locale: ${to}`);
    front.push("---", "");

    // The output path mirrors the input's own shape below `base`, so a source
    // tree and its translation come out the same shape. `base` defaults to
    // `content` for the hand-authored files; an export dump passes its own.
    const target = resolve(outDir, relative(base, file));
    if (!dryRun) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, front.join("\n") + outBody.trimEnd() + "\n", "utf8");
    }
    console.log(
      `${file}: ${segments.length} segments, ${pieces.length} pieces` +
        (dryRun ? " [dry run]" : ` -> ${target}`)
    );
  }
  return failures;
}

async function main() {
  const { flags, files: requested, bools } = parseArgv(process.argv.slice(2));
  const dryRun = bools.has("dry-run");
  const to = parseLocale(flags.get("to") ?? "ml");
  if (!to) throw new Error(`--to must be one of ${LOCALES.join(", ")}`);
  const outDir = flags.get("out") ?? "content/ml";
  const base = flags.get("base") ?? "content";
  const concurrency = Math.max(1, Number(flags.get("concurrency") ?? "4"));
  if (requested.length === 0) throw new Error("no input files");

  // A corpus-sized run is one network failure away from stopping half-done,
  // and re-translating what already landed costs real money. Existing output
  // is the resume point.
  const files = bools.has("skip-existing")
    ? requested.filter((f) => !existsSync(resolve(outDir, relative(base, f))))
    : requested;
  const skipped = requested.length - files.length;
  if (skipped) console.log(`${skipped} file(s) already translated, skipping\n`);
  if (files.length === 0) {
    console.log("nothing left to translate");
    return;
  }

  const segmentsOut = flags.get("segments-out");
  if (segmentsOut) {
    dumpSegments(files, to, segmentsOut);
    return;
  }

  const segmentsIn = flags.get("segments-in");
  const supplied = segmentsIn ? readSegments(segmentsIn) : undefined;
  if (supplied) {
    const absent = files.filter((f) => !supplied.has(f));
    if (absent.length) {
      throw new Error(
        `${absent.length} input file(s) are not in ${segmentsIn}, starting with ${absent[0]}`
      );
    }
  }

  const { GLOSSARY } = await import("@claude-cert/shared");
  const terms = GLOSSARY.map((g) => g.term);
  const opts = { to, outDir, base, dryRun, terms };

  // Files are independent, so run several at once - at one file at a time the
  // corpus is hours spent waiting on the network rather than on the work.
  let failures = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, async () => {
      while (next < files.length) {
        const file = files[next++];
        try {
          // Bind the result before adding it: `failures += await ...` reads
          // `failures` before suspending, so concurrent workers would each
          // write back a total that predates the others' increments.
          const failed = await translateFile(file, {
            ...opts,
            supplied: supplied?.get(file),
          });
          failures += failed;
        } catch (err) {
          console.log(`${file}: ${err instanceof Error ? err.message : err}`);
          failures++;
        }
      }
    })
  );

  console.log(failures === 0 ? "\nall integrity checks passed" : `\n${failures} check(s) failed`);
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
