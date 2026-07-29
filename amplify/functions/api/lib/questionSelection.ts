import { shuffle } from "./shuffle.ts";
import { allocateByWeights } from "./domainWeights.ts";

// For "mixed" exams, skew the draw toward the harder end instead of pulling
// evenly across difficulties - hard should outnumber medium, medium should
// outnumber easy.
const MIXED_DIFFICULTY_WEIGHTS: Record<"hard" | "medium" | "easy", number> = {
  hard: 0.5,
  medium: 0.3,
  easy: 0.2,
};

export function selectMixed<T extends { difficulty: string }>(pool: T[], count: number): T[] {
  const byDifficulty: Record<"hard" | "medium" | "easy", T[]> = {
    hard: shuffle(pool.filter((q) => q.difficulty === "hard")),
    medium: shuffle(pool.filter((q) => q.difficulty === "medium")),
    easy: shuffle(pool.filter((q) => q.difficulty === "easy")),
  };

  const selected: T[] = [];
  for (const diff of ["hard", "medium", "easy"] as const) {
    const target = Math.round(count * MIXED_DIFFICULTY_WEIGHTS[diff]);
    selected.push(...byDifficulty[diff].splice(0, target));
  }

  // A bucket may have come up short of its target (e.g. not enough easy
  // questions yet) - top the exam back up to `count` from whatever's left,
  // hardest-first, so the total is still as close to `count` as the pool allows.
  const leftover = [...byDifficulty.hard, ...byDifficulty.medium, ...byDifficulty.easy];
  while (selected.length < count && leftover.length > 0) {
    selected.push(leftover.shift()!);
  }

  return shuffle(selected).slice(0, count);
}

export type DomainPoolItem = { id: string; difficulty: string; topic: { examDomain: string | null } };

// Allocates `count` across the certification's official exam-blueprint
// domains (e.g. CCAF's Agentic Architecture at 27%, Tool Design at 18%,
// ...), then applies the difficulty selection within each domain's share.
// Falls back to topping up from whatever's left in the whole pool if a
// domain's own sub-pool comes up short at the requested difficulty, so a
// thin domain never silently shrinks the total below `count`. Used by every
// question-drawing surface (full-certification exams, the placement
// assessment, live exams) so none of them fall back to plain random
// sampling across the pool.
export function selectByDomain<T extends DomainPoolItem>(
  pool: T[],
  count: number,
  difficulty: string,
  domainWeights: Record<string, number>
): T[] {
  const byDomain = new Map<string, T[]>();
  for (const q of pool) {
    const domain = q.topic.examDomain;
    if (!domain || !(domain in domainWeights)) continue;
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(q);
  }

  const targets = allocateByWeights(count, domainWeights);
  const selected: T[] = [];
  const usedIds = new Set<string>();

  for (const [domain, target] of Object.entries(targets)) {
    const domainPool = byDomain.get(domain) ?? [];
    const picked = difficulty === "mixed" ? selectMixed(domainPool, target) : shuffle(domainPool).slice(0, target);
    for (const q of picked) usedIds.add(q.id);
    selected.push(...picked);
  }

  if (selected.length < count) {
    for (const q of shuffle(pool.filter((p) => !usedIds.has(p.id)))) {
      if (selected.length >= count) break;
      selected.push(q);
    }
  }

  return shuffle(selected).slice(0, count);
}
