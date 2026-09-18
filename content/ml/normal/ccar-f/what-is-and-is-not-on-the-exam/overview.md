---
cert: CCAR-F
subtopic: overview
mode: normal
locale: ml
title: What Is and Is NOT on the Exam
---
## പരീക്ഷയിൽ എന്തുണ്ട്, എന്തില്ല

ഈ പരിധി പട്ടിക അക്ഷരാർഥത്തിൽ വായിക്കേണ്ടതാണ്: ഇത് നേരിട്ട് ഔദ്യോഗിക പരീക്ഷാ ഗൈഡിന്റെ അനുബന്ധത്തിൽ നിന്നാണ്, ബാക്കിയുള്ള പഠന സമയം എവിടെ കേന്ദ്രീകരിക്കണമെന്ന് ഇത് കൃത്യമായി പറയുന്നു.

> **🗣️ ലളിതമായി പറഞ്ഞാൽ:** പരിധിയിലുള്ളതെല്ലാം Claude ഉപയോഗിച്ച് നിർമിക്കുമ്പോൾ **ആപ്ലിക്കേഷൻ പാളിയിൽ നിങ്ങൾ എടുക്കുന്ന തീരുമാനങ്ങളെ**ക്കുറിച്ചാണ് — agent-കൾ, ടൂളുകൾ, prompt-കൾ, പിഴവ് കൈകാര്യം എന്നിവ എങ്ങനെ ഘടനപ്പെടുത്തുന്നു. പരിധിക്ക് പുറത്തുള്ളതെല്ലാം ഒന്നുകിൽ **infrastructure**, **Anthropic-ന്റെ ആന്തരിക മോഡൽ ജോലി**, അല്ലെങ്കിൽ ഓർമയിൽ നിന്ന് പുനർനിർമിക്കേണ്ടതില്ലെന്ന് പരീക്ഷ കരുതുന്ന **API നടപ്പാക്കൽ വിശദാംശങ്ങൾ** ആണ്.

### ✅ പരിധിയിലുള്ള വിഷയങ്ങൾ (പരീക്ഷയിൽ വരും)

- stop_reason അടിസ്ഥാനമാക്കിയുള്ള agentic loop നിയന്ത്രണ ഒഴുക്ക്
- ടൂൾ ഫലങ്ങൾ കൈകാര്യം ചെയ്യലും loop അവസാനിപ്പിക്കാനുള്ള വ്യവസ്ഥകളും
- Multi-agent orchestration: coordinator-subagent പാറ്റേണുകൾ
- Task decomposition-ഉം സമാന്തരമായ subagent പ്രവർത്തനവും
- Multi-agent സിസ്റ്റങ്ങളിലെ ആവർത്തിച്ചുള്ള പരിഷ്കരണ loop-കൾ
- Subagent-കൾക്കിടയിൽ വ്യക്തമായ context കൈമാറ്റം
- ഘടനാപരമായ state സൂക്ഷിക്കലും തകർച്ചയിൽ നിന്നുള്ള വീണ്ടെടുക്കലും (manifest-കൾ)
### ❌ പരിധിക്ക് പുറത്തുള്ള വിഷയങ്ങൾ (പരീക്ഷയിൽ വരില്ല)

> **ഈ പരീക്ഷയ്ക്ക് ഇവ പഠിക്കേണ്ട**
>
> ഇഷ്ടാനുസൃത മോഡലുകൾ fine-tune ചെയ്യലോ പരിശീലിപ്പിക്കലോ. API authentication, ബില്ലിങ്, അക്കൗണ്ട് മാനേജ്മെന്റ്. MCP server-കൾ വിന്യസിക്കലോ ഹോസ്റ്റ് ചെയ്യലോ (infrastructure). Claude-ന്റെ ആന്തരിക architecture-ഓ മോഡൽ weight-കളോ. Constitutional AI, RLHF, സുരക്ഷാ പരിശീലന രീതികൾ. Embedding മോഡലുകളോ vector database നടപ്പാക്കലോ. Computer use (ബ്രൗസർ ഓട്ടോമേഷൻ, ഡെസ്ക്ടോപ് ഇടപെടൽ). Vision / ചിത്ര വിശകലന ശേഷികൾ. Streaming API നടപ്പാക്കലോ server-sent event-കളോ. Rate limiting, quota, അല്ലെങ്കിൽ API വില കണക്കാക്കൽ. OAuth, API key മാറ്റൽ, authentication പ്രോട്ടോക്കോളുകൾ. പ്രത്യേക ക്ലൗഡ് ദാതാക്കളുടെ ക്രമീകരണങ്ങൾ (AWS, GCP, Azure). പ്രകടന benchmarking-ഓ മോഡൽ താരതമ്യ അളവുകളോ. Prompt caching നടപ്പാക്കലിന്റെ വിശദാംശങ്ങൾ. Token എണ്ണുന്ന അൽഗോരിതങ്ങളോ tokenisation വിശദാംശങ്ങളോ. പ്രത്യേക പ്രോഗ്രാമിങ് ഭാഷകൾ (ടൂൾ/schema ക്രമീകരണത്തിനപ്പുറം).

ഒഴിവാക്കിയവയിലെ മാതൃക ശ്രദ്ധിക്കുക: fine-tuning, RLHF, മോഡലിന്റെ ആന്തരികം, vector database നടപ്പാക്കൽ എന്നിവയെല്ലാം *ഒരു മോഡൽ നിർമിക്കുന്നതിനെയോ പരിശീലിപ്പിക്കുന്നതിനെയോ* കുറിച്ചാണ് — Claude-ന് *മുകളിൽ നിർമിക്കുന്നത്* മാത്രമാണ് പരീക്ഷ പരിശോധിക്കുന്നത്. അതുപോലെ, ബില്ലിങ്, rate limit-കൾ, OAuth, ക്ലൗഡ് ദാതാവിന്റെ പ്രത്യേകതകൾ എന്നിവ, പരീക്ഷ യഥാർഥത്തിൽ പരിശോധിക്കുന്ന architecture തീരുമാനങ്ങൾക്ക് താഴെയിരിക്കുന്ന പ്രവർത്തന/infrastructure വിഷയങ്ങളാണ്.

> **📝️ പരീക്ഷാ ശ്രദ്ധ:** ഒരു architecture, prompt, അല്ലെങ്കിൽ ടൂൾ രൂപകൽപ്പന മറ്റൊന്നിനു പകരം *എന്തുകൊണ്ട്* തിരഞ്ഞെടുക്കുന്നു എന്നതിനെക്കുറിച്ചാണ് ചോദ്യമെങ്കിൽ, അത് പരിധിയിലാണ്. Infrastructure *എങ്ങനെ* വിന്യസിക്കാം, വില നിശ്ചയിക്കാം, authenticate ചെയ്യാം എന്നതിനെക്കുറിച്ചാണെങ്കിൽ, അത് പരിധിക്ക് പുറത്താണ്.

### പരീക്ഷയിൽ പരാമർശിക്കുന്ന സാങ്കേതികവിദ്യകളും ആശയങ്ങളും

| സാങ്കേതികവിദ്യ | എന്ത് അറിയണം |
|---|---|
| Claude Agent SDK | agent നിർവചനങ്ങൾ, agentic loop-കൾ, stop_reason, hooks (PostToolUse, ടൂൾ വിളി തടയൽ), Task tool വഴി subagent തുടങ്ങൽ, allowedTools |
| Model Context Protocol (MCP) | MCP server-കൾ, tools, resources, isError flag, ടൂൾ വിവരണങ്ങൾ, ടൂൾ വിതരണം, .mcp.json, environment variable വികസിപ്പിക്കൽ |
| Claude Code | CLAUDE.md ശ്രേണി (user/project/directory), YAML path-scoping-ഓടു കൂടിയ .claude/rules/, .claude/commands/, frontmatter-ഓടു കൂടിയ .claude/skills/ (context:fork, allowed-tools, argument-hint), plan mode, /memory, /compact, --resume, fork_session, Explore subagent |
| Claude Code CLI | -p / --print flag, --output-format json, --json-schema |
| Claude API | JSON schema-കളോടു കൂടിയ tool_use, tool_choice (auto/any/forced), stop_reason മൂല്യങ്ങൾ, max_tokens, system prompt-കൾ |
| Message Batches API | 50% ചെലവ് ലാഭം, 24 മണിക്കൂർ വരെയുള്ള സമയപരിധി, custom_id, പൂർത്തിയാകാൻ polling, പല turn-കളിലായുള്ള ടൂൾ വിളി ഇല്ല |
| JSON Schema | required vs optional, enum തരങ്ങൾ, nullable ഫീൽഡുകൾ, "other" + വിശദാംശ string മാതൃകകൾ, strict mode |
| Pydantic | schema പരിശോധന, അർഥപരമായ validation പിഴവുകൾ, validation-retry loop-കൾ |
| Built-in ടൂളുകൾ | Read, Write, Edit, Bash, Grep, Glob — അവയുടെ ഉദ്ദേശ്യങ്ങളും ഏതെപ്പോൾ തിരഞ്ഞെടുക്കണമെന്നതും |
