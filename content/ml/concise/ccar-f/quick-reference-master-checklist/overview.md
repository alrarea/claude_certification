---
cert: CCAR-F
subtopic: overview
mode: concise
locale: ml
title: Quick Reference & Master Checklist
---
## പെട്ടെന്നുള്ള റഫറൻസും മാസ്റ്റർ ചെക്ക്‌ലിസ്റ്റും

### പരീക്ഷയുടെ അടിസ്ഥാന വിവരങ്ങൾ

| വിവരം | മൂല്യം |
|---|---|
| ചോദ്യങ്ങൾ | 60 |
| ദൈർഘ്യം | 120 മിനിറ്റ് |
| വിജയിക്കാനുള്ള സ്കോർ | 720 / 1000 |
| പരീക്ഷാ ഫീസ് | $125 USD |
| നൽകുന്ന സാഹചര്യങ്ങൾ | 6-ൽ 4 (യാദൃച്ഛികം) |
| സർട്ടിഫിക്കറ്റിന്റെ കാലാവധി | 12 മാസം |
| വീണ്ടും എഴുതാൻ കാത്തിരിപ്പ് | 14 / 30 / 90 ദിവസം |
| വർഷത്തിൽ പരമാവധി ശ്രമങ്ങൾ | 4 തവണ |

### കൃത്യമായി അറിഞ്ഞിരിക്കേണ്ട 12 നിയമങ്ങൾ

- `stop_reason == "end_turn"` കണ്ടാൽ മാത്രം loop നിർത്തുക — ആവർത്തനങ്ങളുടെ എണ്ണമോ ടെക്സ്റ്റ് പാഴ്‌സിങ്ങോ ഒരിക്കലും അരുത്.
- Coordinator വ്യക്തമായി നൽകുന്നത് മാത്രമേ subagent-കൾക്ക് കിട്ടൂ — സ്വയമേവയുള്ള കൈമാറ്റമില്ല.
- അപൂർണമായ multi-agent ഫലം → coordinator-ന്റെ task decomposition വളരെ ഇടുങ്ങിയതായിരുന്നു.
- വലിയ പ്രത്യാഘാതമുള്ള നിയമങ്ങൾ (സാമ്പത്തികം/compliance/സുരക്ഷ) → prompt അല്ല, hooks വഴി നടപ്പാക്കുക.
- PreToolUse = നടപ്പാക്കുന്നതിനു മുൻപ് തടയുന്നു. PostToolUse = ശേഷം ലോഗ് ചെയ്യുന്നു/രൂപം മാറ്റുന്നു.
- Project-root-ലെ CLAUDE.md = ടീം പങ്കിടുന്നത് (git-ൽ). `~/.claude/CLAUDE.md` = വ്യക്തിപരം (git-ൽ അല്ല).
- Project command-കൾ (`.claude/commands/`) = പങ്കിടുന്നത്. വ്യക്തിപരം (`~/.claude/commands/`) = പ്രാദേശികം.
- JSON schema ഘടന ഉറപ്പാക്കുന്നു, സത്യമല്ല.
- നിർണായക ഉള്ളടക്കം നീണ്ട രേഖകളുടെ ഏറ്റവും മുകളിൽ വെക്കുക (lost-in-middle പ്രഭാവം).
- Routing സംവിധാനം ഉണ്ടാക്കും മുൻപ് ടൂൾ വിവരണങ്ങൾ ശരിയാക്കുക.
- Message Batches API (50% വില കുറവ്, ≤24 മണിക്കൂർ) = തടസ്സപ്പെടുത്താത്ത ജോലികൾക്ക് മാത്രം — merge-നു മുൻപുള്ള പരിശോധനകൾക്ക് ഒരിക്കലും അരുത്.
- CI/CD-യിലെ Claude Code-ന് `-p` ഉപയോഗിക്കുക, അല്ലെങ്കിൽ pipeline തൂങ്ങിനിൽക്കും.

### 6 പരീക്ഷാ കെണികൾ

- "ഒരു system prompt നിർദേശം ചേർക്കുക" — ഉറപ്പായ പാലനത്തിന് തെറ്റാണ്; ഒരു hook ഉപയോഗിക്കുക.
- "കൈമാറ്റത്തിന് sentiment analysis" — നിരാശ ≠ സങ്കീർണത.
- "മോഡൽ സ്വയം പറയുന്ന ആത്മവിശ്വാസം" — LLM-കൾ സ്വയം വിലയിരുത്തുന്നതിൽ മോശമായി calibrate ചെയ്യപ്പെട്ടവയാണ്.
- "വലിയ context window" — lost-in-middle ഇത് പരിഹരിക്കുന്നില്ല.
- "പല തവണ പ്രവർത്തിപ്പിച്ച് ശരാശരി എടുക്കുക" — ഘടനാപരമായ പ്രശ്നങ്ങൾ ഇത് പരിഹരിക്കുന്നില്ല.
- "N ആവർത്തനങ്ങൾക്ക് ശേഷം നിർത്തുക" — തെറ്റ്; എപ്പോഴും `end_turn` കണ്ടാൽ നിർത്തുക.

### ഡൊമെയ്ൻ ചെക്ക്‌ലിസ്റ്റ് (ചുരുക്കം)

- **D1 Agentic Architecture (27%):** loop + stop_reason · subagent isolation · വിഭജനമാണ് മൂലകാരണം · ക്രമാനുഗതം vs. സമാന്തരം · വിശ്വസനീയമായ കൈമാറ്റ ട്രിഗറുകൾ · hooks vs. prompts · `--resume`/`fork_session`
- **D2 Tool Design & MCP (18%):** tools vs. resources · വേർതിരിഞ്ഞ ടൂൾ വിവരണങ്ങൾ · isError + 4 പിഴവ് വിഭാഗങ്ങൾ · `.mcp.json` vs. `~/.claude.json` · Read/Edit/Grep/Glob · `tool_choice` · കുറഞ്ഞ ടൂളുകൾ = മെച്ചപ്പെട്ട പ്രകടനം
- **D3 Claude Code (20%):** 3 തല CLAUDE.md · `@import` + `.claude/rules/` glob-കൾ · project vs. വ്യക്തിപരമായ command-കൾ · skill frontmatter · plan mode vs. നേരിട്ട് · `-p` / `--output-format json` · സ്വതന്ത്ര review > സ്വയം review
- **D4 Prompt Engineering (20%):** വാക്യഘടനാപരം vs. അർഥപരം · `tool_use` + schema · nullable ഫീൽഡുകൾ · few-shot prompting · retry-with-feedback പരിധികൾ · batch vs. തത്സമയ API · per-file + integration review · വ്യക്തം > അവ്യക്തം
- **D5 Context & Reliability (15%):** lost-in-middle · സംഗ്രഹത്തിന്റെ അപകടം · scratchpad/`/compact` · ഘടനാപരമായ പിഴവ് കൈമാറ്റം · വിശ്വസനീയം vs. വിശ്വസിക്കാനാകാത്ത കൈമാറ്റം · ആത്മവിശ്വാസ calibration + stratified sampling · provenance · വൈരുധ്യമുള്ള ഉറവിടങ്ങൾ കൈകാര്യം ചെയ്യൽ

### ഔദ്യോഗിക തയ്യാറെടുപ്പ് വിഭവങ്ങൾ

| വിഭവം | എവിടെ കണ്ടെത്താം |
|---|---|
| ഔദ്യോഗിക പരീക്ഷാ ഗൈഡ് (PDF) | anthropic-partners.skilljar.com (സർട്ടിഫിക്കേഷൻ പേജ്) |
| Claude with the Anthropic API | anthropic.skilljar.com/claude-with-the-anthropic-api |
| Introduction to MCP | anthropic.skilljar.com/introduction-to-model-context-protocol |
| Claude Code in Action | anthropic.skilljar.com/claude-code-in-action |
| Claude 101 | anthropic.skilljar.com/claude-101 |
| പരീക്ഷയ്ക്ക് രജിസ്റ്റർ ചെയ്യുക | anthropic-partners.skilljar.com/claude-certified-architect-foundations-certification |
