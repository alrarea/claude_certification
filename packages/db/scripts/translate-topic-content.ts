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
 *   npx tsx packages/db/scripts/translate-topic-content.ts <files...> \
 *       --to ml --out content/ml
 *   ... --dry-run    no API call: translates by marking text, and still runs
 *                    every integrity check, so the structural half of the
 *                    pipeline can be proven without spending anything.
 *
 * Needs ANTHROPIC_API_KEY for a real run. Exits 1 if any integrity check fails.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  IN_DEPTH_STEPS,
  IN_DEPTH_STEPS_ML,
  LOCALES,
  lintInDepth,
  parseLocale,
  type Locale,
} from "@claude-cert/shared";

const MODEL = "claude-sonnet-5";

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
  // cannot corrupt a file - and small enough that a retry is cheap.
  const CHUNK = 40;
  for (let i = 0; i < segments.length; i += CHUNK) {
    const chunk = segments.slice(i, i + CHUNK);
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: JSON.stringify({ segments: chunk }) }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("model returned no tool_use");
    const payload = block.input as { segments: Segment[] };
    for (const s of payload.segments) out.set(s.id, s.text);
  }
  return out;
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

async function main() {
  const argv = process.argv.slice(2);
  const files = argv.filter((a) => !a.startsWith("--") && !/^(ml|en)$/.test(a));
  const flag = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const dryRun = argv.includes("--dry-run");
  const to = parseLocale(flag("to") ?? "ml");
  if (!to) throw new Error(`--to must be one of ${LOCALES.join(", ")}`);
  const outDir = flag("out") ?? "content/ml";
  if (files.length === 0) throw new Error("no input files");

  const { GLOSSARY } = await import("@claude-cert/shared");
  const terms = GLOSSARY.map((g) => g.term);

  let failures = 0;
  for (const file of files) {
    const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const { fields, body } = parseFrontMatter(raw);
    const from = parseLocale(fields.get("locale") ?? "en") ?? "en";
    const { pieces, segments } = splitPieces(body, from, to);

    const masked = segments.map((s) => {
      const p = protect(s.text);
      return { seg: { id: s.id, text: p.masked }, restore: p.restore };
    });

    let translated: Map<number, string>;
    if (dryRun) {
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

    const target = resolve(outDir, file.replace(/^content[\\/]/, ""));
    if (!dryRun) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, front.join("\n") + outBody.trimEnd() + "\n", "utf8");
    }
    console.log(
      `${file}: ${segments.length} segments, ${pieces.length} pieces` +
        (dryRun ? " [dry run]" : ` -> ${target}`)
    );
  }

  console.log(failures === 0 ? "\nall integrity checks passed" : `\n${failures} check(s) failed`);
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
