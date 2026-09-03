| ≤280 w, no code |
| 2 || ≤280 w, no code |# Authoring in-depth course content

In-depth is the mode a candidate opens when they want to *actually build the thing*. Normal mode
already carries the clear explanation. In-depth exists to add what Normal deliberately leaves out:
**real implementation code and a named production system where the concept earns its keep.**

The test for a finished topic is blunt. Open the topic in Normal, then in In-depth. If In-depth is
just a friendlier version of the same page — no runnable code, no production architecture — it
isn't done.

## How the content is rendered

In-depth markdown is rendered by `apps/web/src/components/InDepthWizard.tsx` as a stepped modal:

- **Every `## ` heading starts a new wizard step.** The heading becomes the step title in the
  header; the body is everything until the next `## `.
- `###` and deeper stay *inside* a step as ordinary subheadings.
- Prose before the first `## ` becomes a phantom step titled "Introduction" — never do this.
- The **last step carries the Finish button**, which marks the topic complete. It has to read like
  a close, not like the middle of a thought.

So the heading structure isn't cosmetic — it's the navigation. The machine-readable half of this
document is `packages/shared/src/inDepth.ts` (`IN_DEPTH_STEPS`), which the ingest script and the
drift check both enforce. If the two ever disagree, that file wins.

## The nine steps

Exactly nine, in this order, with these headings verbatim (step 6 is the one exception — you append
your scenario's name).

| # | Heading | What goes in it | Budget |
|---|---|---|---|
| 1 | `## What Problem Are We Solving?` | The production situation where the naive approach breaks. Not a definition — a problem. Close with a `> **🗣️ In plain English:**` callout. | ≤280 w, no code |
| 2 | `## Meet the Moving Parts` | The actors and who does what, bulleted. Name where people get confused. | ≤280 w, no code |
| 3 | `## How It Works, Step by Step` | Numbered walkthrough in real primitives — `stop_reason == "tool_use"`, `tool_result` blocks, the Task tool, `PreToolUse` hook JSON, `session_id`. One `mermaid` `flowchart TD`. | ≤400 w, ≤1 code, ≤1 diagram |
| 4 | `## Minimal Working Implementation` | The smallest thing that **actually runs**. No `...` elisions, copy-pasteable. One line before it saying what to run and what you'll see. Usually one `python` block; a second is allowed only when running it genuinely takes two artifacts (a script *plus* the `.claude/settings.json` that wires it up). | ≤180 w prose, ≤2 code blocks |
| 5 | `## Production Implementation` | The hardening delta: turn and token caps, retries, idempotency, structured logging, permission gating, timeouts. Elisions allowed, marked `# ...`. Follow with a bullet list of *what changed and why*. | ≤300 w, ≤2 code |
| 6 | `## In Production: <Named Scenario>` | A specific named system — not "imagine a company". Turn-by-turn walkthrough with real numbers (turns, tokens, latency, concurrency, cost), one `mermaid` `sequenceDiagram`, and a `> **🌍 Real-world example:**`. | ≤450 w, ≤1 code, ≤1 diagram |
| 7 | `## Where This Applies — and Where It Doesn't` | One GFM table: Situation / Use this / Use instead. Then the explicit anti-patterns. | ≤300 w, no code |
| 8 | `## Failure Modes Seen in the Wild` | 3–4 **named** failure modes as Symptom → Cause → Fix. At least one as `> **⚠️ Watch out:**`. | ≤350 w, ≤1 code |
| 9 | `## Exam Lens & Key Takeaway` | `> **📝 Exam focus:**` (what's tested, the distractor patterns), then `> **🔑 Key takeaway:**` in ≤3 sentences. | ≤240 w, no code |

Whole topic: **1,500–2,900 words.** Steps 4–8 are the reason the mode exists.

## Rules

**Structure**

- No prose before the first `## `. No `# ` H1 — the topic title already renders in the modal header,
  so repeating it wastes the first step.
- Nine steps, no more, no fewer. If a topic genuinely doesn't support a production scenario, that's
  a signal the topic needs rethinking, not an exemption.

**Callouts.** A blockquote gets its colour from its first bold run, matched by `calloutVariant` in
`packages/shared/src/inDepth.ts`. Use these labels exactly, or the callout renders as plain grey:

```text
> **🗣️ In plain English:** …
> **💡 Tip:** …
> **⚠️ Watch out:** …
> **🔑 Key takeaway:** …
> **📝 Exam focus:** …
> **🌍 Real-world example:** …
> **🚫 Out of scope:** …
```

**Code**

- Always tag the fence: `python`, `json`, `bash`, `yaml`, `text`, `mermaid`.
- **≤88 characters per line.** Code doesn't soft-wrap — long lines force horizontal scrolling.
- ≤45 lines per block, ≤2 blocks per step.
- Python for SDK and agent code; `json` for `.claude/settings.json` and hook config; `bash` for CLI.
- Model IDs must be current: `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5`.
  A `claude-3-*` reference is a hard error.
- **Verify SDK shapes against current docs rather than writing them from memory** — method names,
  block types, and parameter names. The `claude-api` skill exists for this.

**Diagrams.** `flowchart TD` for mechanism, `sequenceDiagram` for the production trace. ≤9 nodes,
≤60-character labels, ≤2 per topic. Mermaid runs with `securityLevel: "strict"`, so wrap any label
containing parentheses or quotes as `["…"]`.

**Files.** LF line endings (enforced by `.gitattributes`; CRLF is a lint error because it would
leave a carriage return on every step title).

## File layout and front matter

One file per topic:

```text
content/in-depth/<cert>/<domain>/<subtopic>-<slug>.md
content/in-depth/ccar-f/d1/1.5-hooks.md
```

Filenames are cosmetic — the front matter is what resolves the topic:

```text
---
cert: CCAR-F
domain: D1
subtopic: 1.5
mode: in_depth
title: Hooks — Intercepting Tool Calls
---
```

- **`subtopic` is the key**, not `title`. `migrate-guides.ts` sets each subtopic's `orderIndex`
  from the minor number of its `N.M` heading, so `1.5` resolves deterministically in any database.
  Topic UUIDs are per-environment and titles contain em dashes — neither makes a usable key.
- `subtopic: overview` (or omitting it) targets the domain topic itself.
- `title` is a **checksum**: a mismatch against the database prints a warning so you notice the
  guide was re-worded, but it never blocks the write.
- `mode` is authoritative, so this same pipeline serves `concise` when that pass happens.
- Files whose basename starts with `_` are skipped, which is why `_TEMPLATE.md` is safe to keep here.

## Workflow

```bash
cp content/in-depth/_TEMPLATE.md content/in-depth/ccar-f/d1/1.5-hooks.md

# What does Normal mode already say? In-depth must not just restate it.
npm run content:export -- --cert CCAR-F --domain D1 --mode normal --out .content-export/normal

# Resolve the topic, lint, print per-step counts - writes nothing.
npm run content:ingest -- content/in-depth/ccar-f/d1/1.5-hooks.md --dry-run --verbose

npm run content:ingest -- content/in-depth/ccar-f/d1/1.5-hooks.md

# Is the domain done? Exits 0 only when every topic in it is OK.
npm run content:check -- --cert CCAR-F --domain D1 --verbose
```

`content:check` classifies every topic as `OK`, `NONCONFORMING` (distinct but off-contract),
`IDENTICAL` (in_depth is a copy of normal — the original problem), or `MISSING`. Run it with no
filters for the cross-domain burndown.

## Checking the code and diagrams

`lintInDepth` counts and measures code blocks but cannot parse them — it's TypeScript and the
samples are Python. Run this before committing a domain; it has already caught a Python block
broken by an editing slip that every other check passed:

```bash
python - <<'EOF'
import pathlib, re, json
BS = chr(92)
bad = []
for f in sorted(pathlib.Path("content/in-depth").rglob("*.md")):
    if f.name.startswith("_"):
        continue
    for lang, body in re.findall(r"```(python|json)\n(.*?)```",
                                 f.read_text(encoding="utf-8"), re.S):
        try:
            compile(body, f.name, "exec") if lang == "python" else json.loads(body)
        except Exception as exc:
            bad.append(f"{f.name} [{lang}]: {exc}")
        # A doubled backslash-n in a Python string is a literal two-character
        # sequence, not a newline - and it compiles cleanly, so nothing else
        # catches it. Same for a backslash before a real newline.
        if lang == "python" and ((BS + BS + "n") in body or (BS + "\n") in body):
            bad.append(f"{f.name}: escape hazard in a string literal")
print("\n".join(bad) or "all python compiles, all json parses, no escape hazards")
EOF
```

**Prefer code that needs no escapes at all.** Triple-quoted strings and f-strings with real line
breaks avoid the whole category — `TESTS = """..."""` rather than a single-quoted string full of
`\n`. 3.5's sample is written that way deliberately.

Two things it does not cover, worth doing by hand per domain:

- **Mermaid labels.** `securityLevel: "strict"` means a label containing `(`, `)` or a quote must
  be wrapped as `["…"]`. An unwrapped one renders as "(diagram couldn't be rendered)" — silent.
  Apostrophes in labels (`the role's tools`) are the usual offender.
- **Step 4 actually running.** Compiling is not running. Where the sample needs no API key (2.6's
  `edit_unique`, for instance), extract it and run it.
