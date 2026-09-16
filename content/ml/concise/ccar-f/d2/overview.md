---
cert: CCAR-F
domain: D2
subtopic: overview
mode: concise
locale: ml
title: Tool Design & MCP Integration
---
## ടൂൾ ഡിസൈനും MCP സംയോജനവും — ഉപവിഷയങ്ങൾ

- വ്യക്തവും വേർതിരിഞ്ഞതുമായ ടൂൾ വിവരണങ്ങൾ എഴുതൽ (ടൂൾ തിരഞ്ഞെടുക്കൽ പിഴവുകൾക്കുള്ള സ്ഥിരം പരിഹാരം)
- MCP അടിസ്ഥാനങ്ങൾ: tools vs. resources, server ക്രമീകരണം (project vs. user scope)
- ഘടനാപരമായ പിഴവ് കൈകാര്യം ചെയ്യൽ: `isError` flag, transient vs. business vs. permission പിഴവുകൾ
- `tool_choice`: auto / any / നിർബന്ധിത ടൂൾ തിരഞ്ഞെടുക്കൽ
- Least privilege — തിരഞ്ഞെടുക്കലിന്റെ കൃത്യത കുറയാതിരിക്കാൻ ഓരോ agent-നും ടൂളുകളുടെ എണ്ണം കുറയ്ക്കൽ
