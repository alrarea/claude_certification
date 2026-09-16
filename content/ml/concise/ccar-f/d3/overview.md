---
cert: CCAR-F
domain: D3
subtopic: overview
mode: concise
locale: ml
title: Claude Code Configuration & Workflows
---
## Claude Code ക്രമീകരണവും workflows-ഉം — ഉപവിഷയങ്ങൾ

- CLAUDE.md ശ്രേണി (user / project / directory), `@import`
- `.claude/rules/` — glob അടിസ്ഥാനമാക്കിയ, path പരിധിയുള്ള രീതികൾ
- Project vs. വ്യക്തിപരമായ commands-ഉം skills-ഉം; skill frontmatter (`context:fork`, `allowed-tools`, `argument-hint`)
- Plan mode vs. നേരിട്ടുള്ള നിർവഹണം — ജോലിയുടെ സങ്കീർണതയും അവ്യക്തതയും ആദ്യം ആസൂത്രണം ആവശ്യപ്പെടുമ്പോൾ
- ഇടപെടലില്ലാത്ത/CI ഉപയോഗം: `-p` flag, `--output-format json`
