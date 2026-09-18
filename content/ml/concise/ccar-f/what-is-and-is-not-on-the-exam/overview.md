---
cert: CCAR-F
subtopic: overview
mode: concise
locale: ml
title: What Is and Is NOT on the Exam
---
## പരീക്ഷയിൽ എന്തുണ്ട്, എന്തില്ല

### ✅ പരിധിയിലുള്ള വിഷയങ്ങൾ (പരീക്ഷയിൽ വരും)

- stop_reason അടിസ്ഥാനമാക്കിയുള്ള agentic loop നിയന്ത്രണ ഒഴുക്ക്
- ടൂൾ ഫലങ്ങൾ കൈകാര്യം ചെയ്യലും loop അവസാനിപ്പിക്കാനുള്ള വ്യവസ്ഥകളും
- Multi-agent orchestration: coordinator-subagent പാറ്റേണുകൾ
- Task decomposition-ഉം സമാന്തരമായ subagent പ്രവർത്തനവും
- Multi-agent സിസ്റ്റങ്ങളിലെ ആവർത്തിച്ചുള്ള പരിഷ്കരണ loop-കൾ
- Subagent-കൾക്കിടയിൽ വ്യക്തമായ context കൈമാറ്റം
- ഘടനാപരമായ state സൂക്ഷിക്കലും തകർച്ചയിൽ നിന്നുള്ള വീണ്ടെടുക്കലും (manifest-കൾ)
- ടൂൾ ഇന്റർഫേസ് രൂപകൽപ്പന: ഫലപ്രദമായ വിവരണങ്ങൾ, വിഭജിക്കണോ കൂട്ടിച്ചേർക്കണോ
- MCP ടൂൾ, resource രൂപകൽപ്പനയും വിവരണത്തിന്റെ ഗുണനിലവാരവും
- MCP server ക്രമീകരണം: project vs. user scope, env var വികസിപ്പിക്കൽ
- പിഴവ് കൈകാര്യം ചെയ്യൽ: ഘടനാപരമായ പ്രതികരണങ്ങൾ, transient vs. business vs. permission
- കൈമാറ്റ തീരുമാനങ്ങൾ: വ്യക്തമായ മാനദണ്ഡങ്ങൾ, നയത്തിലെ വിടവ് കണ്ടെത്തൽ
- CLAUDE.md ശ്രേണി (user/project/directory), @import രീതികൾ
- Path അടിസ്ഥാന നിയമങ്ങൾക്കായി glob മാതൃകകളുള്ള .claude/rules/
- ഇഷ്ടാനുസൃത command-കളും skill-കളും: project vs. user scope, context:fork, allowed-tools, argument-hint
- Plan mode vs. നേരിട്ടുള്ള നിർവഹണം: സങ്കീർണത വിലയിരുത്തൽ
- ആവർത്തിച്ചുള്ള പരിഷ്കരണം: input/output ഉദാഹരണങ്ങൾ, test-driven iteration, interview pattern
- tool_use വഴി ഘടനാപരമായ ഔട്ട്പുട്ട്: schema രൂപകൽപ്പന, tool_choice, nullable ഫീൽഡുകൾ
- Few-shot prompting: അവ്യക്തമായ സാഹചര്യങ്ങൾ, രൂപ സ്ഥിരത, false positive കുറയ്ക്കൽ
- Batch പ്രോസസ്സിങ്: Message Batches API, latency സഹിഷ്ണുത, custom_id വഴി പരാജയം കൈകാര്യം ചെയ്യൽ
- Context window ഒപ്റ്റിമൈസേഷൻ: നീണ്ട ഔട്ട്പുട്ടുകൾ ചുരുക്കൽ, ഘടനാപരമായ വസ്തുതാ extraction
- മനുഷ്യ review workflows: ആത്മവിശ്വാസ calibration, stratified sampling
- വിവര provenance: വാദം-ഉറവിടം ബന്ധങ്ങൾ, കാലസംബന്ധിയായ ഡാറ്റ, വൈരുധ്യം അടയാളപ്പെടുത്തൽ

### ❌ പരിധിക്ക് പുറത്തുള്ള വിഷയങ്ങൾ (പരീക്ഷയിൽ വരില്ല)

- ഇഷ്ടാനുസൃത മോഡലുകൾ fine-tune ചെയ്യലോ പരിശീലിപ്പിക്കലോ
- API authentication, ബില്ലിങ്, അക്കൗണ്ട് മാനേജ്മെന്റ്
- MCP server-കൾ വിന്യസിക്കലോ ഹോസ്റ്റ് ചെയ്യലോ (infrastructure)
- Claude-ന്റെ ആന്തരിക architecture-ഓ മോഡൽ weight-കളോ
- Constitutional AI, RLHF, സുരക്ഷാ പരിശീലന രീതികൾ
- Embedding മോഡലുകളോ vector database നടപ്പാക്കലോ
- Computer use (ബ്രൗസർ ഓട്ടോമേഷൻ, ഡെസ്ക്ടോപ് ഇടപെടൽ)
- Vision / ചിത്ര വിശകലന ശേഷികൾ
- Streaming API നടപ്പാക്കലോ server-sent event-കളോ
- Rate limiting, quota, അല്ലെങ്കിൽ API വില കണക്കാക്കൽ
- OAuth, API key മാറ്റൽ, authentication പ്രോട്ടോക്കോളുകൾ
- പ്രത്യേക ക്ലൗഡ് ദാതാക്കളുടെ ക്രമീകരണങ്ങൾ (AWS, GCP, Azure)
- പ്രകടന benchmarking-ഓ മോഡൽ താരതമ്യ അളവുകളോ
- Prompt caching നടപ്പാക്കലിന്റെ വിശദാംശങ്ങൾ
- Token എണ്ണുന്ന അൽഗോരിതങ്ങളോ tokenisation വിശദാംശങ്ങളോ
- പ്രത്യേക പ്രോഗ്രാമിങ് ഭാഷകൾ (ടൂൾ/schema ക്രമീകരണത്തിനപ്പുറം)
