/**
 * The technical vocabulary that stays in English inside translated prose,
 * with the meaning to show on hover.
 *
 * Why terms stay English: the certification exam is in English. A learner who
 * only ever met a Malayalam coinage for `stop_reason` would be reading an exam
 * question about a term they had never seen. So the term is kept and the
 * *meaning* is translated - which only works if the meaning is reachable,
 * hence the tooltip.
 *
 * This file is the authoritative list. `content/in-depth/_GLOSSARY.md` is the
 * editorial guidance that points here; keeping the table in two places would
 * let them drift, and this one is the one the site actually renders.
 *
 * `term` is matched case-insensitively against Latin-script runs in Malayalam
 * prose, longest first, so "cache hit rate" wins over "cache".
 */

export interface GlossaryEntry {
  term: string;
  /** One line, English - the same wording authors are told to use inline. */
  en: string;
  /** The same meaning in Malayalam, for the tooltip. */
  ml: string;
  category: string;
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  // --- Latency and throughput ---
  {
    term: "p95",
    en: "the value 95% of requests come in under — the slow tail, not the average",
    ml: "95% അഭ്യർഥനകളും ഇതിനുള്ളിൽ പൂർത്തിയാകുന്നു — ശരാശരിയല്ല, വൈകുന്ന ഭാഗം",
    category: "latency",
  },
  {
    term: "p99",
    en: "the value 99% of requests come in under — the slowest 1% exceed it",
    ml: "99% അഭ്യർഥനകളും ഇതിനുള്ളിൽ പൂർത്തിയാകുന്നു — ഏറ്റവും വൈകുന്ന 1% ഇതിലധികം എടുക്കുന്നു",
    category: "latency",
  },
  {
    term: "latency",
    en: "how long one request takes end to end, from send to last token",
    ml: "ഒരു അഭ്യർഥന അയച്ചു തുടങ്ങി അവസാന ഉത്തരം വരെ എടുക്കുന്ന സമയം",
    category: "latency",
  },
  {
    term: "throughput",
    en: "how many requests the system completes per unit of time",
    ml: "ഒരു നിശ്ചിത സമയത്ത് സിസ്റ്റം പൂർത്തിയാക്കുന്ന അഭ്യർഥനകളുടെ എണ്ണം",
    category: "latency",
  },
  {
    term: "backpressure",
    en: "deliberately slowing or rejecting new work so a queue cannot grow without bound",
    ml: "ക്യൂ അനിയന്ത്രിതമായി വളരാതിരിക്കാൻ പുതിയ ജോലി മനഃപൂർവം വൈകിപ്പിക്കുകയോ നിരസിക്കുകയോ ചെയ്യുന്നത്",
    category: "latency",
  },
  {
    term: "circuit breaker",
    en: "a switch that stops calling a failing dependency for a cool-off period",
    ml: "പരാജയപ്പെടുന്ന സേവനത്തെ വീണ്ടും വിളിക്കാതെ കുറച്ചു സമയത്തേക്ക് നിർത്തിവയ്ക്കുന്ന സ്വിച്ച്",
    category: "latency",
  },

  // --- Prompt caching and tokens ---
  {
    term: "token",
    en: "roughly a word-piece; the unit the model reads and bills by",
    ml: "മാതൃക വായിക്കുകയും നിരക്ക് ഈടാക്കുകയും ചെയ്യുന്ന ഏകകം — ഏകദേശം ഒരു വാക്കിന്റെ ഭാഗം",
    category: "caching",
  },
  {
    term: "prompt caching",
    en: "reusing the work already done on the start of a prompt",
    ml: "പ്രോംപ്റ്റിന്റെ തുടക്കഭാഗത്ത് ഇതിനകം ചെയ്ത ജോലി വീണ്ടും ഉപയോഗിക്കുന്ന രീതി",
    category: "caching",
  },
  {
    term: "prefix",
    en: "the beginning of a prompt, up to some point — what caching matches on",
    ml: "പ്രോംപ്റ്റിന്റെ തുടക്കഭാഗം — കാഷിങ് ഒത്തുനോക്കുന്നത് ഇതിനെയാണ്",
    category: "caching",
  },
  {
    term: "breakpoint",
    en: 'the cache_control marker saying "everything before this point is cacheable"',
    ml: '"ഇതിനു മുൻപുള്ളതെല്ലാം കാഷ് ചെയ്യാം" എന്ന് അടയാളപ്പെടുത്തുന്ന cache_control അടയാളം',
    category: "caching",
  },
  {
    term: "TTL",
    en: "time to live — how long a cache entry survives before it expires",
    ml: "ഒരു കാഷ് എൻട്രി കാലഹരണപ്പെടുന്നതിനു മുൻപ് നിലനിൽക്കുന്ന സമയം",
    category: "caching",
  },
  {
    term: "cache hit rate",
    en: "the share of input tokens served from cache rather than reprocessed",
    ml: "വീണ്ടും പ്രോസസ് ചെയ്യാതെ കാഷിൽ നിന്ന് ലഭിച്ച ഇൻപുട്ട് ടോക്കണുകളുടെ അനുപാതം",
    category: "caching",
  },
  {
    term: "invalidation",
    en: "a cache entry becoming unusable because the content it covered changed",
    ml: "ഉള്ളടക്കം മാറിയതിനാൽ കാഷ് എൻട്രി ഉപയോഗശൂന്യമാകുന്നത്",
    category: "caching",
  },
  {
    term: "context window",
    en: "the total tokens a model can hold at once — prompt plus output",
    ml: "ഒരു അഭ്യർഥനയിൽ ഉൾക്കൊള്ളാവുന്ന ആകെ വാചകം — പ്രോംപ്റ്റും ഉത്തരവും ചേർന്ന്",
    category: "caching",
  },

  // --- Correctness and evaluation ---
  {
    term: "precision",
    en: "of the items the system flagged, the share that were genuinely right",
    ml: "സിസ്റ്റം അടയാളപ്പെടുത്തിയവയിൽ യഥാർഥത്തിൽ ശരിയായവയുടെ അനുപാതം",
    category: "evaluation",
  },
  {
    term: "recall",
    en: "of the items it should have flagged, the share it actually caught",
    ml: "അടയാളപ്പെടുത്തേണ്ടിയിരുന്നവയിൽ യഥാർഥത്തിൽ കണ്ടെത്തിയവയുടെ അനുപാതം",
    category: "evaluation",
  },
  {
    term: "TPR",
    en: "true positive rate — the same quantity as recall, named for comparing groups",
    ml: "ട്രൂ പോസിറ്റീവ് റേറ്റ് — recall തന്നെ, വിഭാഗങ്ങൾ താരതമ്യം ചെയ്യുമ്പോൾ ഉപയോഗിക്കുന്ന പേര്",
    category: "evaluation",
  },
  {
    term: "noise floor",
    en: "the smallest difference an eval this size can distinguish from luck",
    ml: "ഈ വലുപ്പമുള്ള ഒരു eval-ന് ഭാഗ്യത്തിൽ നിന്ന് വേർതിരിക്കാനാകുന്ന ഏറ്റവും ചെറിയ വ്യത്യാസം",
    category: "evaluation",
  },
  {
    term: "stratified split",
    en: "dividing cases into train and test so each keeps the same mix",
    ml: "ഓരോ വിഭാഗത്തിന്റെയും യഥാർഥ അനുപാതം നിലനിർത്തി train, test എന്നിങ്ങനെ വിഭജിക്കുന്നത്",
    category: "evaluation",
  },
  {
    term: "golden set",
    en: "a fixed set of cases with known-correct answers, changed deliberately and rarely",
    ml: "ശരിയുത്തരം അറിയാവുന്ന, അപൂർവമായി മാത്രം മാറ്റുന്ന നിശ്ചിത കേസുകളുടെ കൂട്ടം",
    category: "evaluation",
  },
  {
    term: "drift",
    en: "the gradual divergence of live behaviour from what was measured or written down",
    ml: "എഴുതിവച്ചതിൽ നിന്നോ അളന്നതിൽ നിന്നോ തത്സമയ പ്രവർത്തനം ക്രമേണ അകന്നുപോകുന്നത്",
    category: "evaluation",
  },

  // --- Systems and safety ---
  {
    term: "idempotent",
    en: "running it twice has the same effect as running it once — safe to retry",
    ml: "രണ്ടു തവണ ചെയ്താലും ഒരു തവണ ചെയ്തതിന്റെ ഫലം തന്നെ — വീണ്ടും ശ്രമിക്കാൻ സുരക്ഷിതം",
    category: "systems",
  },
  {
    term: "deterministic",
    en: "the same input always produces the same output",
    ml: "ഒരേ ഇൻപുട്ട് എപ്പോഴും ഒരേ ഔട്ട്പുട്ട് നൽകുന്നു",
    category: "systems",
  },
  {
    term: "schema",
    en: "the declared shape of data — which fields exist, of what type, which are required",
    ml: "ഡാറ്റയുടെ പ്രഖ്യാപിത രൂപം — ഏതൊക്കെ ഫീൽഡുകൾ, ഏത് തരം, ഏതൊക്കെ നിർബന്ധം",
    category: "systems",
  },
  {
    term: "guardrail",
    en: "a check outside the model that blocks or flags output it shouldn't emit",
    ml: "മാതൃകയ്ക്കു പുറത്തുനിന്ന് അനുചിതമായ ഔട്ട്പുട്ട് തടയുന്ന പരിശോധന",
    category: "systems",
  },
  {
    term: "least privilege",
    en: "granting exactly the access the task needs, and nothing beyond it",
    ml: "ജോലിക്ക് ആവശ്യമായ അനുമതി മാത്രം നൽകുക, അതിലധികം ഒന്നും",
    category: "systems",
  },
  {
    term: "provenance",
    en: "the record of where a piece of information came from",
    ml: "ഒരു വിവരം എവിടെനിന്ന് വന്നു എന്നതിന്റെ രേഖ",
    category: "systems",
  },
  {
    term: "checkpoint",
    en: "saved state a long task can resume from instead of restarting",
    ml: "വീണ്ടും തുടങ്ങാതെ തുടരാൻ കഴിയുന്ന വിധം സൂക്ഷിച്ച അവസ്ഥ",
    category: "systems",
  },
  {
    term: "fan-out",
    en: "splitting one request into many parallel ones",
    ml: "ഒരു അഭ്യർഥനയെ സമാന്തരമായി പ്രവർത്തിക്കുന്ന പലതായി വിഭജിക്കുന്നത്",
    category: "systems",
  },

  // --- API surface. Named explicitly as terms that must stay English. ---
  {
    term: "stop_reason",
    en: 'the field saying why Claude stopped — "tool_use" means it needs a tool run, "end_turn" means it is finished',
    ml: "Claude എന്തുകൊണ്ട് നിർത്തി എന്ന് പറയുന്ന ഫീൽഡ് — tool_use എന്നാൽ ഒരു ടൂൾ വേണം, end_turn എന്നാൽ പൂർത്തിയായി",
    category: "api",
  },
  {
    term: "tool_use",
    en: "the block in which Claude requests a tool run — a request, never an action",
    ml: "ഒരു ടൂൾ പ്രവർത്തിപ്പിക്കാൻ Claude ആവശ്യപ്പെടുന്ന ബ്ലോക്ക് — അഭ്യർഥന മാത്രം, പ്രവൃത്തിയല്ല",
    category: "api",
  },
  {
    term: "tool_result",
    en: "what your code hands back to Claude after actually running the tool",
    ml: "നിങ്ങളുടെ കോഡ് ടൂൾ പ്രവർത്തിപ്പിച്ച ശേഷം Claude-ന് തിരികെ നൽകുന്ന ഫലം",
    category: "api",
  },
  {
    term: "end_turn",
    en: "the stop_reason meaning Claude considers the task complete",
    ml: "ജോലി പൂർത്തിയായി എന്ന് Claude കരുതുന്നു എന്ന് കാണിക്കുന്ന stop_reason",
    category: "api",
  },
  {
    term: "MCP",
    en: "Model Context Protocol — a standard way to connect an AI client to outside systems",
    ml: "Model Context Protocol — ഒരു AI ക്ലയന്റിനെ പുറത്തുള്ള സിസ്റ്റങ്ങളുമായി ബന്ധിപ്പിക്കാനുള്ള മാനദണ്ഡം",
    category: "api",
  },
  {
    term: "RAG",
    en: "retrieval-augmented generation — fetch the relevant passages and put them in the prompt",
    ml: "Retrieval-augmented generation — ബന്ധപ്പെട്ട ഭാഗങ്ങൾ കണ്ടെത്തി പ്രോംപ്റ്റിൽ ചേർത്ത് ഉത്തരം നൽകുന്ന രീതി",
    category: "api",
  },
  {
    term: "SLA",
    en: "service level agreement — a binding promise about speed, accuracy or availability",
    ml: "സേവന നിലവാര കരാർ — വേഗത, കൃത്യത, ലഭ്യത എന്നിവയെക്കുറിച്ചുള്ള ബാധ്യതയുള്ള വാഗ്ദാനം",
    category: "api",
  },

  // --- Agents and orchestration. The corpus's most-used vocabulary, and the
  // words the exam itself asks about, so a Malayalam coinage for any of them
  // would leave a reader meeting the real term for the first time on exam day.
  {
    term: "agent",
    en: "a model given tools and a goal, which decides its own next step until the goal is met",
    ml: "ടൂളുകളും ഒരു ലക്ഷ്യവും നൽകിയ മോഡൽ — ലക്ഷ്യം പൂർത്തിയാകുംവരെ അടുത്ത നടപടി സ്വയം തീരുമാനിക്കുന്നു",
    category: "agents",
  },
  {
    term: "subagent",
    en: "a second agent an agent starts for one scoped piece of work, with its own context",
    ml: "ഒരു ഏജന്റ് ഒരു പ്രത്യേക ജോലിക്കായി തുടങ്ങുന്ന രണ്ടാമത്തെ ഏജന്റ് — സ്വന്തം context-ഓടു കൂടി",
    category: "agents",
  },
  {
    term: "multi-agent",
    en: "a design where several agents divide the work instead of one agent doing all of it",
    ml: "ഒരൊറ്റ ഏജന്റ് എല്ലാം ചെയ്യുന്നതിനു പകരം പല ഏജന്റുകൾ ജോലി പങ്കിടുന്ന രൂപകൽപ്പന",
    category: "agents",
  },
  {
    term: "orchestration",
    en: "deciding which agent or step runs when, and how results pass between them",
    ml: "ഏത് ഏജന്റ് അഥവാ ഘട്ടം എപ്പോൾ പ്രവർത്തിക്കണം, ഫലങ്ങൾ എങ്ങനെ കൈമാറണം എന്ന ക്രമീകരണം",
    category: "agents",
  },
  {
    term: "coordinator",
    en: "the agent that hands out work to the others and puts their results together",
    ml: "മറ്റ് ഏജന്റുകൾക്ക് ജോലി വിഭജിച്ചു നൽകി അവയുടെ ഫലങ്ങൾ ചേർത്തുവയ്ക്കുന്ന ഏജന്റ്",
    category: "agents",
  },
  {
    term: "agentic loop",
    en: "the repeating cycle of think, call a tool, read the result, decide again",
    ml: "ചിന്തിക്കുക, ടൂൾ വിളിക്കുക, ഫലം വായിക്കുക, വീണ്ടും തീരുമാനിക്കുക — ഈ ആവർത്തിക്കുന്ന ചക്രം",
    category: "agents",
  },
  {
    term: "pipeline",
    en: "a fixed sequence of steps where each step's output is the next one's input",
    ml: "ഓരോ ഘട്ടത്തിന്റെയും ഫലം അടുത്തതിന്റെ ഇൻപുട്ടാകുന്ന, മുൻകൂട്ടി നിശ്ചയിച്ച ഘട്ടങ്ങളുടെ ശ്രേണി",
    category: "agents",
  },
  {
    term: "session",
    en: "one continuous run with its own conversation history, which can be resumed later",
    ml: "സ്വന്തം സംഭാഷണ ചരിത്രമുള്ള ഒരു തുടർച്ചയായ പ്രവർത്തനം — പിന്നീട് തുടരാവുന്നത്",
    category: "agents",
  },

  // --- Configuration and control ---
  {
    term: "prompt",
    en: "the instructions and context sent to the model for one request",
    ml: "ഒരു അഭ്യർഥനയ്ക്കായി മോഡലിന് അയക്കുന്ന നിർദേശങ്ങളും context-ഉം",
    category: "config",
  },
  {
    term: "context",
    en: "everything the model can see for this request — instructions, history, tool results",
    ml: "ഈ അഭ്യർഥനയിൽ മോഡലിന് കാണാവുന്നതെല്ലാം — നിർദേശങ്ങൾ, ചരിത്രം, ടൂൾ ഫലങ്ങൾ",
    category: "config",
  },
  {
    term: "hook",
    en: "code the harness runs on a tool call, which can block it — a rule, not a request",
    ml: "ഒരു ടൂൾ വിളിക്കുമ്പോൾ harness പ്രവർത്തിപ്പിക്കുന്ന കോഡ് — തടയാനും കഴിയും; അഭ്യർഥനയല്ല, നിയമം",
    category: "config",
  },
  {
    term: "CLAUDE.md",
    en: "the file Claude Code reads as standing project instructions on every session",
    ml: "ഓരോ session-ലും Claude Code വായിക്കുന്ന, പ്രോജക്റ്റിന്റെ സ്ഥിരം നിർദേശങ്ങളുള്ള ഫയൽ",
    category: "config",
  },
  {
    term: "retry",
    en: "running a failed step again, usually after a wait, rather than giving up on it",
    ml: "പരാജയപ്പെട്ട ഘട്ടം ഉപേക്ഷിക്കാതെ, സാധാരണ അൽപ്പം കാത്തിരുന്ന ശേഷം വീണ്ടും പ്രവർത്തിപ്പിക്കൽ",
    category: "config",
  },
  {
    term: "validation",
    en: "checking output against a rule before trusting it, not after something breaks",
    ml: "എന്തെങ്കിലും തകർന്ന ശേഷമല്ല, വിശ്വസിക്കുന്നതിനു മുൻപ് ഫലം ഒരു നിയമവുമായി ഒത്തുനോക്കൽ",
    category: "config",
  },
] as const;

/**
 * Terms longest-first, so "cache hit rate" is matched before "cache" and
 * "tool_result" before "tool". Callers should walk this in order and take the
 * first hit.
 */
export const GLOSSARY_BY_LENGTH: readonly GlossaryEntry[] = [...GLOSSARY].sort(
  (a, b) => b.term.length - a.term.length
);

const BY_TERM = new Map(GLOSSARY.map((e) => [e.term.toLowerCase(), e]));

export function lookupGlossaryTerm(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(term.toLowerCase());
}

/**
 * Where glossary terms appear in a run of text, longest match first and never
 * overlapping.
 *
 * This is deliberately an explicit term alternation rather than "wrap every
 * Latin-script run". In Malayalam prose a Latin run is by construction a term
 * that was kept in English, but not every one of them is *in* the glossary -
 * product names, "Claude", "AWS" - and wrapping those would promise a
 * definition that does not exist. Unmatched runs are reported separately so
 * they can be added to the list rather than silently swallowed.
 */
const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

const TERM_PATTERN = new RegExp(
  `(?:${GLOSSARY_BY_LENGTH.map((e) => e.term.replace(ESCAPE_RE, "\\$&")).join("|")})`,
  "gi"
);

export interface GlossaryMatch {
  start: number;
  end: number;
  entry: GlossaryEntry;
}

export function findGlossaryMatches(text: string): GlossaryMatch[] {
  const out: GlossaryMatch[] = [];
  TERM_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_PATTERN.exec(text)) !== null) {
    const entry = lookupGlossaryTerm(m[0]);
    if (!entry) continue;
    // Reject a hit sitting inside a longer word: "tokenise" is not "token",
    // and "recalling" is not "recall". Underscores and hyphens count as part
    // of a term, so stop_reason and fan-out still match.
    const isWordish = (ch: string | undefined) =>
      ch !== undefined && /[A-Za-z0-9_-]/.test(ch);
    const before = text[m.index - 1];
    if (isWordish(before)) continue;

    // An English plural is still the term: "agents" is agent. Only a single
    // trailing "s" counts, so "recalling" is still not "recall". The character
    // after it is tested without the hyphen, so "agents-ന്റെ" takes the plural
    // and then the suffix rule below; "agents-based" is left to that rule to
    // reject as the compound it is.
    const isLetterish = (ch: string | undefined) =>
      ch !== undefined && /[A-Za-z0-9_]/.test(ch);
    let end = m.index + m[0].length;
    if (text[end] === "s" && !isLetterish(text[end + 1])) end++;

    // A trailing hyphen is the one case where "part of a longer word" is the
    // wrong reading. Malayalam attaches a case ending to an English noun with
    // a hyphen - "agent-ന്റെ", "context-ഇൽ" - so blanket-rejecting a hyphen
    // after the term switched the tooltip off for exactly the construction the
    // translated prose uses most. The compound it was written to catch is
    // "fan-out", where a Latin letter follows the hyphen; a Malayalam letter
    // following it is a suffix, and the term before it is the term.
    const after = text[end];
    const suffixHyphen = after === "-" && !/[A-Za-z0-9_]/.test(text[end + 1] ?? "");
    if (isWordish(after) && !suffixHyphen) continue;
    out.push({ start: m.index, end, entry });
  }
  return out;
}

/** Latin-script runs that are NOT in the glossary - candidates to add. */
export function findUnglossedLatinRuns(text: string): string[] {
  const matched = findGlossaryMatches(text);
  const covered = (i: number) => matched.some((x) => i >= x.start && i < x.end);
  const runs: string[] = [];
  const re = /[A-Za-z][A-Za-z0-9_.-]*(?: [A-Za-z][A-Za-z0-9_.-]*)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!covered(m.index)) runs.push(m[0]);
  }
  return runs;
}
