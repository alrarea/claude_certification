/**
 * Parses every ```mermaid block in the content with the real Mermaid parser,
 * at the same version and securityLevel the app renders with.
 *
 * lintInDepth counts diagrams but cannot parse them, so a diagram that is
 * syntactically wrong passes every other check and then fails in the browser
 * with "Syntax error in text" - visible only to whoever opens that topic.
 * Ad-hoc regex checks are not a substitute: they caught unquoted parentheses
 * and apostrophes and still missed real parse errors.
 *
 * Usage:
 *   node scripts/check-mermaid.mjs                 # all in-depth content
 *   node scripts/check-mermaid.mjs <files...>      # specific files
 *
 * Exits 1 if any diagram fails to parse.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { JSDOM } from "jsdom";

// Mermaid pulls in DOMPurify, which needs a real window to install its hooks -
// without one, every flowchart fails with "DOMPurify.addHook is not a function"
// and masks the genuine parse errors. Set the DOM up before importing mermaid.
const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.Element = dom.window.Element;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Node = dom.window.Node;
globalThis.DOMParser = dom.window.DOMParser;

const { default: mermaid } = await import("mermaid");

// Must match apps/web/src/components/Mermaid.tsx - strict mode is what makes
// unescaped labels fail, so parsing under anything looser proves nothing.
mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });

function collect(target) {
  if (statSync(target).isFile()) return [target];
  return readdirSync(target)
    .filter((n) => !n.startsWith("_"))
    .flatMap((n) => {
      const child = join(target, n);
      if (statSync(child).isDirectory()) return collect(child);
      return extname(n) === ".md" && basename(n) !== "AUTHORING.md" ? [child] : [];
    })
    .sort();
}

const args = process.argv.slice(2);
const files = args.length ? args.flatMap(collect) : collect("content/in-depth");

let total = 0;
const failures = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const [i, m] of [...src.matchAll(/```mermaid\n([\s\S]*?)```/g)].entries()) {
    total++;
    const line = src.slice(0, m.index).split("\n").length;
    try {
      await mermaid.parse(m[1]);
    } catch (err) {
      failures.push({ file, line, index: i + 1, message: String(err?.message ?? err) });
    }
  }
}

for (const f of failures) {
  console.log(`✗ ${f.file}:${f.line}  (diagram ${f.index})`);
  console.log(
    f.message
      .split("\n")
      .slice(0, 6)
      .map((l) => `    ${l}`)
      .join("\n")
  );
}

console.log(
  `\n${total} diagram(s) parsed, ${failures.length} failed` +
    (failures.length ? "" : " - all render")
);
if (failures.length) process.exitCode = 1;
