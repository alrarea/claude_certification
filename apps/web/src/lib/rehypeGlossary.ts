import { findGlossaryMatches } from "@claude-cert/shared";

/**
 * Wraps glossary terms so they can carry a hover definition.
 *
 * This runs on the parsed tree rather than on the markdown source, which is
 * what makes "never match inside code" structural instead of a regex that has
 * to guess where the backticks were: by the time we see the tree, an inline
 * code span is already an `code` element, so skipping its subtree is exact.
 *
 * Only worth enabling for translated content. In English prose the terms are
 * the ordinary words of the sentence, and underlining every "token" and
 * "schema" would be noise rather than help.
 */

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Subtrees whose text is markup, not prose. */
const OPAQUE = new Set(["code", "pre", "a"]);

function splitTextNode(node: HastNode): HastNode[] | null {
  const text = node.value ?? "";
  const matches = findGlossaryMatches(text);
  if (matches.length === 0) return null;

  const out: HastNode[] = [];
  let cursor = 0;
  for (const m of matches) {
    // Overlaps cannot happen (matches are longest-first and non-overlapping),
    // but a defensive skip keeps a bad match from reordering the sentence.
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      out.push({ type: "text", value: text.slice(cursor, m.start) });
    }
    out.push({
      type: "element",
      tagName: "span",
      properties: {
        className: ["glossary-term"],
        "data-term": m.entry.term,
        "data-meaning": m.entry.ml,
      },
      children: [{ type: "text", value: text.slice(m.start, m.end) }],
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    out.push({ type: "text", value: text.slice(cursor) });
  }
  return out;
}

export function rehypeGlossary() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (!node.children) return;
      const next: HastNode[] = [];
      for (const child of node.children) {
        if (child.type === "text") {
          next.push(...(splitTextNode(child) ?? [child]));
          continue;
        }
        if (child.type === "element" && OPAQUE.has(child.tagName ?? "")) {
          next.push(child);
          continue;
        }
        walk(child);
        next.push(child);
      }
      node.children = next;
    };
    walk(tree);
  };
}
