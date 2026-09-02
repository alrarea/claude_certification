/**
 * The in-depth content contract, in machine-readable form.
 *
 * In-depth topic content is authored as markdown under `content/in-depth/` and
 * rendered by the web app's InDepthWizard as a stepped walkthrough: every
 * `## ` heading starts a new step. That makes the heading structure
 * load-bearing rather than cosmetic, so it's specified here (IN_DEPTH_STEPS)
 * and checked by `lintInDepth` before anything reaches the database.
 *
 * Both the renderer and the checker import from this file - the wizard uses
 * `parseInDepthSteps` to split content, and `MarkdownContent` uses
 * `calloutVariant` to style blockquotes - so a rule can't drift between "what
 * the checker allows" and "what the UI actually does with it".
 *
 * The prose companion to this file is `content/in-depth/AUTHORING.md`.
 */

export interface InDepthStep {
  title: string;
  body: string;
}

/**
 * Splits in-depth markdown into wizard steps. Each "## Heading" starts a new
 * step (title = heading text, body = everything until the next "## ");
 * anything before the first "##" becomes an unnumbered intro step. "###" and
 * deeper stay inside a step as ordinary subheadings.
 *
 * Content authored to the contract never produces that intro step - prose
 * before the first "## " is a lint error - but the fallback stays because the
 * wizard also renders the older hand-authored rows still in the database.
 */
export function parseInDepthSteps(markdown: string): InDepthStep[] {
  const lines = markdown.split("\n");
  const steps: InDepthStep[] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  function flush() {
    const bodyText = currentBody.join("\n").trim();
    if (currentTitle !== null || bodyText) {
      steps.push({ title: currentTitle ?? "Introduction", body: bodyText });
    }
  }

  for (const line of lines) {
    const headingMatch = /^##\s+(.*)$/.exec(line);
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return steps;
}

/**
 * Maps a callout's leading bold label to a style variant. Shared with the
 * renderer, which is why the matching is substring-based and order-sensitive
 * rather than a clean lookup: "Exam tip" hits the `tip` branch before the
 * `exam` one. Authors don't need to care - they just need a label that lands
 * on something other than "default", which is what `lintInDepth` warns about.
 */
export function calloutVariant(label: string): string {
  const t = label.toLowerCase();
  if (t.includes("tip")) return "tip";
  if (t.includes("watch out") || t.includes("warning") || t.includes("caution")) return "warn";
  if (t.includes("key takeaway") || t.includes("key point") || t.includes("the rule")) return "key";
  if (t.includes("exam focus") || t.includes("exam tip") || t.includes("exam ")) return "exam";
  if (t.includes("plain english") || t.includes("plain language")) return "plain";
  if (t.includes("real-world") || t.includes("real world")) return "real";
  if (t.includes("out of scope") || t.includes("not on the exam")) return "oos";
  return "default";
}

/** The canonical labels, in the form authors should type them. */
export const CALLOUT_LABELS = [
  "In plain English",
  "Tip",
  "Watch out",
  "Key takeaway",
  "Exam focus",
  "Real-world example",
  "Out of scope",
] as const;

export interface InDepthStepSpec {
  /**
   * "exact" - the heading must match verbatim. "prefix" - the author appends
   * their own text, e.g. "In Production: A CI Agent That Fixes Failing Tests".
   */
  match: "exact" | "prefix";
  heading: string;
  maxWords: number;
  maxCodeBlocks: number;
  maxDiagrams: number;
}

/** The nine steps, in order. A conforming topic has exactly these. */
export const IN_DEPTH_STEPS: readonly InDepthStepSpec[] = [
  { match: "exact", heading: "What Problem Are We Solving?", maxWords: 280, maxCodeBlocks: 0, maxDiagrams: 0 },
  { match: "exact", heading: "Meet the Moving Parts", maxWords: 280, maxCodeBlocks: 0, maxDiagrams: 0 },
  { match: "exact", heading: "How It Works, Step by Step", maxWords: 400, maxCodeBlocks: 1, maxDiagrams: 1 },
  { match: "exact", heading: "Minimal Working Implementation", maxWords: 180, maxCodeBlocks: 2, maxDiagrams: 0 },
  { match: "exact", heading: "Production Implementation", maxWords: 300, maxCodeBlocks: 2, maxDiagrams: 0 },
  { match: "prefix", heading: "In Production:", maxWords: 450, maxCodeBlocks: 1, maxDiagrams: 1 },
  { match: "exact", heading: "Where This Applies — and Where It Doesn't", maxWords: 300, maxCodeBlocks: 0, maxDiagrams: 0 },
  { match: "exact", heading: "Failure Modes Seen in the Wild", maxWords: 350, maxCodeBlocks: 1, maxDiagrams: 0 },
  { match: "exact", heading: "Exam Lens & Key Takeaway", maxWords: 240, maxCodeBlocks: 0, maxDiagrams: 0 },
] as const;

/** The step whose code block has to run exactly as pasted. */
const MINIMAL_IMPL_STEP_INDEX = 3;

export const MAX_CODE_LINE_LENGTH = 88;
export const MAX_CODE_BLOCK_LINES = 45;
export const MIN_TOPIC_WORDS = 1500;
export const MAX_TOPIC_WORDS = 2900;
export const MAX_DIAGRAMS_PER_TOPIC = 2;

/** Fences we accept a language tag from. `text` is the escape hatch. */
const ALLOWED_FENCE_LANGUAGES = ["python", "json", "bash", "yaml", "text", "mermaid", "typescript", "sql"];

export interface FencedBlock {
  language: string;
  lines: string[];
  /** 1-based line number of the opening fence, within the step body. */
  startLine: number;
}

/**
 * Splits a step body into its fenced blocks and everything else. Fence
 * detection is line-anchored so an inline triple-backtick inside prose can't
 * open a phantom block.
 */
export function splitFencedBlocks(body: string): { blocks: FencedBlock[]; prose: string[] } {
  const fenceRe = new RegExp("^\\s*" + "`".repeat(3) + "(.*)$");
  const blocks: FencedBlock[] = [];
  const prose: string[] = [];
  let current: FencedBlock | null = null;

  body.split("\n").forEach((line, i) => {
    const fence = fenceRe.exec(line);
    if (fence) {
      if (current) {
        blocks.push(current);
        current = null;
      } else {
        current = { language: fence[1].trim(), lines: [], startLine: i + 1 };
      }
      return;
    }
    if (current) current.lines.push(line);
    else prose.push(line);
  });

  // An unterminated fence still gets returned - lintInDepth reports it via the
  // block's own checks rather than silently dropping the content.
  if (current) blocks.push(current);
  return { blocks, prose };
}

/**
 * Drops every fenced block from a document. Needed before any check that
 * looks for markdown syntax: `# ` opens an H1 in prose but is a comment in
 * Python, bash and YAML, so an unfiltered scan flags every commented code
 * sample as a stray heading.
 */
function stripFences(markdown: string): string {
  const fence = "`".repeat(3);
  let inside = false;
  return markdown
    .split("\n")
    .filter((line) => {
      if (line.trimStart().startsWith(fence)) {
        inside = !inside;
        return false;
      }
      return !inside;
    })
    .join("\n");
}

function countWords(proseLines: string[]): number {
  return proseLines
    .join(" ")
    .replace(/[>|#*`_[\]()-]/g, " ")
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]/.test(w)).length;
}

/** The leading bold run of each blockquote line, i.e. the callout labels. */
function calloutLabels(proseLines: string[]): string[] {
  const labels: string[] = [];
  for (const line of proseLines) {
    if (!/^\s*>/.test(line)) continue;
    const bold = /\*\*(.+?)\*\*/.exec(line);
    if (bold) labels.push(bold[1].replace(/:$/, "").trim());
  }
  return labels;
}

export interface InDepthStepStats {
  title: string;
  words: number;
  codeBlocks: number;
  diagrams: number;
}

export interface InDepthLintResult {
  errors: string[];
  warnings: string[];
  steps: InDepthStepStats[];
  totalWords: number;
}

/**
 * Checks one topic's in-depth markdown against the contract. Errors block an
 * ingest - they mean the wizard would render something broken, or the content
 * isn't actually in-depth. Warnings are budget and style nudges.
 */
export function lintInDepth(markdown: string): InDepthLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: InDepthStepStats[] = [];

  if (markdown.includes("\r")) {
    errors.push("CRLF line endings - every step title would keep a trailing carriage return");
  }
  if (/^#\s+/m.test(stripFences(markdown))) {
    errors.push("contains an `# ` H1 - the topic title already renders in the wizard header");
  }
  if (/claude-3[.-]/.test(markdown)) {
    errors.push("references a retired `claude-3-*` model id");
  }

  const steps = parseInDepthSteps(markdown);
  if (steps.length > 0 && steps[0].title === "Introduction") {
    errors.push("prose before the first `## ` heading - it renders as a phantom 'Introduction' step");
  }
  if (steps.length !== IN_DEPTH_STEPS.length) {
    errors.push(`has ${steps.length} steps, contract requires exactly ${IN_DEPTH_STEPS.length}`);
  }

  let totalWords = 0;
  let totalDiagrams = 0;

  steps.forEach((step, i) => {
    const spec = IN_DEPTH_STEPS[i];
    const { blocks, prose } = splitFencedBlocks(step.body);
    const diagrams = blocks.filter((b) => b.language === "mermaid").length;
    const codeBlocks = blocks.length - diagrams;
    const words = countWords(prose);

    stats.push({ title: step.title, words, codeBlocks, diagrams });
    totalWords += words;
    totalDiagrams += diagrams;

    const where = `step ${i + 1} ("${step.title}")`;

    if (spec) {
      const headingOk =
        spec.match === "exact" ? step.title === spec.heading : step.title.startsWith(spec.heading);
      if (!headingOk) {
        const expected =
          spec.match === "exact" ? `"${spec.heading}"` : `a heading starting "${spec.heading}"`;
        errors.push(`${where}: expected ${expected}`);
      } else if (spec.match === "prefix" && step.title.slice(spec.heading.length).trim().length < 4) {
        errors.push(`${where}: name the scenario after "${spec.heading}" - it must be specific`);
      }
      if (codeBlocks > spec.maxCodeBlocks) {
        errors.push(`${where}: ${codeBlocks} code blocks, max ${spec.maxCodeBlocks}`);
      }
      if (diagrams > spec.maxDiagrams) {
        errors.push(`${where}: ${diagrams} diagrams, max ${spec.maxDiagrams}`);
      }
      if (i === MINIMAL_IMPL_STEP_INDEX && codeBlocks === 0) {
        errors.push(`${where}: needs a runnable code block - it is the point of the step`);
      }
      if (words > spec.maxWords) {
        warnings.push(`${where}: ${words} words, budget ${spec.maxWords}`);
      }
    }

    for (const block of blocks) {
      if (!block.language) {
        errors.push(`${where}: untagged code fence at body line ${block.startLine}`);
      } else if (!ALLOWED_FENCE_LANGUAGES.includes(block.language)) {
        warnings.push(`${where}: unusual fence language "${block.language}"`);
      }
      if (block.language !== "mermaid" && block.lines.length > MAX_CODE_BLOCK_LINES) {
        errors.push(
          `${where}: code block is ${block.lines.length} lines, max ${MAX_CODE_BLOCK_LINES}`
        );
      }
      const overLong = block.lines.filter((l) => l.length > MAX_CODE_LINE_LENGTH).length;
      if (overLong > 0) {
        errors.push(`${where}: ${overLong} code line(s) over ${MAX_CODE_LINE_LENGTH} chars`);
      }
      // Step 4 is the copy-pasteable one; elisions belong in step 5 onward.
      if (i === MINIMAL_IMPL_STEP_INDEX && block.lines.some((l) => /^\s*(#\s*)?\.\.\.\s*$/.test(l))) {
        errors.push(`${where}: elided code - this step must run as pasted`);
      }
    }

    for (const label of calloutLabels(prose)) {
      if (calloutVariant(label) === "default") {
        warnings.push(`${where}: callout "${label}" renders unstyled - see CALLOUT_LABELS`);
      }
    }
  });

  if (totalDiagrams > MAX_DIAGRAMS_PER_TOPIC) {
    warnings.push(`${totalDiagrams} diagrams in the topic, guideline is ${MAX_DIAGRAMS_PER_TOPIC}`);
  }
  if (steps.length === IN_DEPTH_STEPS.length && totalWords < MIN_TOPIC_WORDS) {
    warnings.push(`${totalWords} words total, contract targets at least ${MIN_TOPIC_WORDS}`);
  }
  if (totalWords > MAX_TOPIC_WORDS) {
    warnings.push(`${totalWords} words total, contract caps at ${MAX_TOPIC_WORDS}`);
  }

  return { errors, warnings, steps: stats, totalWords };
}
