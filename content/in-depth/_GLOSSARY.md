# Glossary — agreed wording for specialist terms

Every term here appeared in in-depth topics **with no definition anywhere in the corpus**. That is
the bug this file exists to prevent: the reader may have opened In-depth first, so a term used as
though known is a wall.

**The authoritative list now lives in `packages/shared/src/glossary.ts`**, which carries the same
wording plus a Malayalam translation. It is no longer only an authoring aid: in translated content
these terms stay in English and the site renders each one with its Malayalam meaning on hover or
tap, so the list is a user-facing feature and the two copies must not drift. Add terms there; this
file is the editorial guidance around it.

**How to use it.** Define the term inline at its first use in the topic — same sentence or the
next one — using the agreed wording, adapted to fit the sentence. Do not link here; the learner
never sees this file. Its job is to stop the same term being explained three different ways
across three topics.

Keep definitions to one line. If a term genuinely needs a paragraph, it needs a topic, not a
glossary entry.

## Latency and throughput

| Term | Wording to use |
|---|---|
| `p95` / `p99` | the value 95% (or 99%) of requests come in under — the slow tail, not the average |
| latency | how long one request takes end to end, from send to last token |
| time to first token | how long before *any* output appears, which is what a user perceives as speed |
| throughput | how many requests the system completes per unit of time |
| queueing | work waiting for a busy resource; wait time climbs sharply as utilisation nears capacity |
| backpressure | deliberately slowing or rejecting new work so a queue cannot grow without bound |
| circuit breaker | a switch that stops calling a failing dependency for a cool-off period instead of retrying into it |

## Prompt caching and tokens

| Term | Wording to use |
|---|---|
| token | roughly a word-piece; the unit the model reads and bills by |
| prefix | the beginning of a prompt, up to some point — what caching matches on |
| breakpoint | the `cache_control` marker saying "everything before this point is cacheable" |
| TTL | time to live — how long a cache entry survives before it expires |
| cache hit rate | the share of input tokens served from cache rather than reprocessed |
| invalidation | a cache entry becoming unusable because the content it covered changed |
| context window | the total tokens a model can hold at once — prompt plus output |

## Correctness and evaluation

| Term | Wording to use |
|---|---|
| precision | of the items the system flagged, the share that were genuinely right |
| recall | of the items it should have flagged, the share it actually caught |
| TPR | true positive rate — the same quantity as recall, named for comparing groups |
| noise floor | the smallest difference an eval this size can distinguish from luck, about `1/sqrt(n·R)` |
| stratified split | dividing cases into train and test so each keeps the same mix, never by score |
| golden set | a fixed set of cases with known-correct answers, changed deliberately and rarely |
| drift | the gradual divergence of live behaviour from what was measured or written down |

## Systems and safety

| Term | Wording to use |
|---|---|
| idempotent | running it twice has the same effect as running it once — safe to retry |
| deterministic | the same input always produces the same output |
| schema | the declared shape of data — which fields exist, of what type, which are required |
| guardrail | a check outside the model that blocks or flags output the model shouldn't emit |
| least privilege | granting exactly the access the task needs, and nothing beyond it |
| provenance | the record of where a piece of information came from |
| checkpoint | saved state a long task can resume from instead of restarting |
| fan-out | splitting one request into many parallel ones |
