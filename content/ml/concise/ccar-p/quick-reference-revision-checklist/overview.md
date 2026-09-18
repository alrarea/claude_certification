---
cert: CCAR-P
subtopic: overview
mode: concise
locale: ml
title: Quick Reference & Revision Checklist
---
# പെട്ടെന്നുള്ള റഫറൻസും ആവർത്തന ചെക്ക്‌ലിസ്റ്റും (Concise)

**അടിസ്ഥാന വിവരങ്ങൾ:** CCAR-P · 63 ചോദ്യങ്ങൾ · 120 മിനിറ്റ് · വിജയം 720/1000 · $175 · 12 മാസ സാധുത · Pearson VUE · Professional നിലവാരം · v1.0 (ജൂലൈ 2026)

**12 പ്രധാന നിയമങ്ങൾ:**
1. Least privilege = ആവശ്യമില്ലാത്ത ടൂളുകൾ നീക്കം ചെയ്യുക, വെറുതെ ലോഗ് ചെയ്യുകയോ സ്ഥിരീകരിക്കുകയോ അല്ല.
2. Prompt caching = സ്ഥിരമായ ഉള്ളടക്കം ആദ്യം, മാറുന്നത് അവസാനം.
3. രേഖകൾ പുതുക്കിയ ശേഷമുള്ള RAG പിഴവുകൾ → മോഡലല്ല, re-indexing പരിശോധിക്കുക.
4. A/B testing = ഒരു സമയത്ത് ഒരു ഘടകം, ഒരേ eval ഡാറ്റാസെറ്റ്.
5. GDPR: ഡാറ്റ കുറയ്ക്കൽ, ഉദ്ദേശ്യ പരിമിതി, മായ്ക്കാനുള്ള അവകാശം, സുതാര്യത.
6. HIPAA: എൻക്രിപ്ഷൻ, audit log-കൾ, പ്രവേശന നിയന്ത്രണം, ചോർച്ച അറിയിക്കൽ.
7. HITL: വലിയ അപകടസാധ്യതയുള്ള/തിരിച്ചെടുക്കാനാകാത്ത നടപടികൾക്ക് approval gate; സൂക്ഷ്മമായ ഉള്ളടക്കത്തിന് review queue.
8. SLA ആണ് മോഡൽ തിരഞ്ഞെടുപ്പിനെ നയിക്കുന്നത്: latency → ചെറിയ മോഡൽ + caching; കൃത്യത → വലിയ മോഡൽ + RAG.
9. Observability: അഭ്യർഥന/പ്രതികരണം + token-കൾ + latency + retrieval ഫലങ്ങൾ ലോഗ് ചെയ്യുക.
10. ഉറപ്പോടെയുള്ള തെറ്റുത്തരങ്ങൾ = retrieval പ്രശ്നം, മോഡലിന്റെ പ്രശ്നമല്ല.
11. Hybrid retrieval (അർഥാധിഷ്ഠിതം + keyword) ഏതൊന്നിനെക്കാളും മെച്ചം.
12. വിട്ടുവീഴ്ചാ തീരുമാനങ്ങൾ സാങ്കേതിക ഇഷ്ടവുമായല്ല, ബിസിനസ് മൂല്യവുമായി ബന്ധിപ്പിക്കുക.

**ഡൊമെയ്ൻ ചെക്ക്‌ലിസ്റ്റ് (തൂക്കം):**
- **D1 Solution Design (17%):** architecture pattern ഇണക്കം; 5 ബിസിനസ് മൂല്യ സ്തംഭങ്ങൾ; multi-agent topology; വിഭജനം (functional/data/domain); input→processing→output→feedback loop
- **D2 Models/Prompting/Context (13%):** മോഡലിന്റെ വലുപ്പ വിട്ടുവീഴ്ചകൾ; zero/few-shot/CoT; caching (സ്ഥിരം ആദ്യം); context window തന്ത്രങ്ങൾ; system prompt രൂപകൽപ്പന
- **D3 Integration (19%):** MCP vs API vs agent-to-agent; മുഴുവൻ RAG pipeline; chunking; retrieval തരങ്ങൾ (semantic/keyword/hybrid/re-rank); least privilege; observability; വിട്ടുവീഴ്ചയുടെ ന്യായീകരണം
- **D4 Evaluation (16%):** അളവുകൾ (കൃത്യത/latency/ചെലവ്/സുരക്ഷ/hallucination); eval ഡാറ്റാസെറ്റ് രൂപകൽപ്പന; A/B testing; ലക്ഷണ നിർണയം; ചെലവ് ഉപാധികൾ (caching/വലുപ്പം/batch/max_tokens)
- **D5 Governance (14%):** GDPR/HIPAA/FedRAMP; guardrail-കൾ (input/output/hooks); HITL രീതികൾ; bias/fairness/transparency; പരാജയ രീതികൾ (hallucination/injection/ചോർച്ച/drift)
- **D6 Stakeholders (14%):** discovery-യും വിജയ മാനദണ്ഡങ്ങളും; വിട്ടുവീഴ്ചാ ആശയവിനിമയം; SLA രൂപകൽപ്പന; മുഴുവൻ ജീവിതചക്രത്തിന്റെ ഉടമസ്ഥത
- **D7 Dev Productivity (7%):** Claude Code config ശ്രേണി; ടീം workflows (slash commands, CI/CD); പ്രവർത്തന പ്രശ്ന നിർണയം

**തയ്യാറെടുപ്പ് ചെക്ക്‌ലിസ്റ്റ്:** blueprint പഠിക്കുക → തുടക്കം മുതൽ ഒടുക്കം വരെയുള്ള ഒരു RAG+eval സൊല്യൂഷൻ ഉണ്ടാക്കുക → ഔദ്യോഗിക രേഖകൾ വായിക്കുക → architecture തീരുമാനങ്ങൾ പരിശീലിക്കുക → മാതൃകാ ചോദ്യങ്ങൾ ചെയ്യുക.
