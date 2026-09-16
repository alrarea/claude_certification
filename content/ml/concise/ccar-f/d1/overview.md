---
cert: CCAR-F
domain: D1
subtopic: overview
mode: concise
locale: ml
title: Agentic Architecture & Orchestration
---
## എജന്റിക് ആർക്കിടെക്ചറും ഓർക്കസ്ട്രേഷനും — ഉപവിഷയങ്ങൾ

- agentic loop നിയന്ത്രണവും `stop_reason` മൂല്യങ്ങളും (ആവർത്തനങ്ങളുടെ എണ്ണം നോക്കിയോ ടെക്സ്റ്റ് പാഴ്‌സിങ് വഴിയോ ഒരിക്കലും നിർത്തരുത്)
- Coordinator–subagent orchestration: task decomposition, സമാന്തരം vs. ക്രമാനുഗതം
- Context isolation — subagent-കൾക്ക് വ്യക്തമായി നൽകുന്നത് മാത്രമേ ലഭിക്കൂ
- Hooks (PreToolUse/PostToolUse), programmatic enforcement vs. prompt അടിസ്ഥാനമാക്കിയുള്ള മാർഗനിർദേശം
- Plan mode vs. നേരിട്ടുള്ള നിർവഹണം; session management (`--resume`, `fork_session`)
