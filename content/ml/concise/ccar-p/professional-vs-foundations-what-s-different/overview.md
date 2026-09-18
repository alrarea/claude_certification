---
cert: CCAR-P
subtopic: overview
mode: concise
locale: ml
title: Professional vs. Foundations — What's Different?
---
# Professional vs. Foundations — എന്താണ് വ്യത്യാസം? (Concise)

**Foundations-ൽ (CCAR-F) ഇതിനകം ഉൾപ്പെട്ടത്** — അറിയാമെന്ന് കരുതുന്നു, വീണ്ടും പഠിപ്പിക്കുന്നില്ല:
- Agentic loop / `stop_reason`
- Subagent isolation-ഉം context കൈമാറ്റവും
- CLAUDE.md config ശ്രേണി
- Hooks vs. prompt നിർദേശങ്ങൾ
- ടൂൾ വിവരണങ്ങളും MCP അടിസ്ഥാനങ്ങളും
- JSON schema / ഘടനാപരമായ ഔട്ട്പുട്ട്
- Lost-in-middle പ്രഭാവം

**Professional-ൽ (CCAR-P) പുതിയത്:**
- RAG pipeline രൂപകൽപ്പനയും retrieval തന്ത്രങ്ങളും
- വിലയിരുത്തൽ ചട്ടക്കൂടുകളും അളവുകളും
- A/B testing-ഉം ആവർത്തിച്ചുള്ള പുരോഗതിയും
- Compliance: GDPR, HIPAA, FedRAMP
- Ethical AI: bias, fairness, transparency
- പങ്കാളികളുമായുള്ള ആശയവിനിമയവും SLA-കളും
- സംയോജന പ്രോട്ടോക്കോൾ തിരഞ്ഞെടുപ്പ് (MCP vs. API vs. agent-to-agent)
- ചെലവ്–latency–കൃത്യത വിട്ടുവീഴ്ചകൾ
- വലിയ തോതിലുള്ള observability-യും നിരീക്ഷണവും
- Human-in-the-loop പരിശോധനാ രൂപകൽപ്പന
- Prompt caching-ഉം പുനരുപയോഗ തന്ത്രങ്ങളും
- മുഴുവൻ ജീവിതചക്ര മാനേജ്മെന്റ് (discovery → handoff → iteration)

> **🔑️ പ്രധാന നിഗമനം:** Foundations = Claude എങ്ങനെ പ്രവർത്തിക്കുന്നു എന്ന് അറിയൽ. Professional = architecture തിരഞ്ഞെടുപ്പുകൾ തീരുമാനിക്കൽ, ന്യായീകരിക്കൽ, അവയുടെ ഫലങ്ങൾക്ക് ഉത്തരവാദിയാകൽ.
