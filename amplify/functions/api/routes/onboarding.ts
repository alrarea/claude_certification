import { Hono } from "hono";
import { prisma } from "@claude-cert/db";
import { onboardingChoiceSchema } from "@claude-cert/shared";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware.ts";
import { shuffle } from "../lib/shuffle.ts";

export const onboardingRoutes = new Hono<{ Variables: AuthedVars }>();
onboardingRoutes.use("*", requireAuth);

// Foundations block: 2 easy / 3 medium / 5 hard, interleaved - first question
// easy, then one medium, then two hard, then the rest of each bucket in the
// same easy/medium/hard order.
const CCAF_SEQUENCE = [
  "easy",
  "medium",
  "hard",
  "hard",
  "easy",
  "medium",
  "medium",
  "hard",
  "hard",
  "hard",
] as const;

// Professional-tier tail: 1 easy / 2 medium / 2 hard, appended after the
// foundations block. This is the "ready for CCAR-P?" check - the score on
// this block is what the results page uses as the readiness signal.
const CCAP_SEQUENCE = ["easy", "medium", "hard", "medium", "hard"] as const;

async function fetchPool(certificationId: string, userId: string) {
  return prisma.question.findMany({
    where: {
      certificationId,
      isActive: true,
      OR: [{ reviewStatus: "approved" }, { reviewStatus: "pending", createdBy: userId }],
    },
    select: { id: true, difficulty: true },
  });
}

function buildAssessmentOrder<T extends { difficulty: string }>(
  pool: T[],
  sequence: readonly ("easy" | "medium" | "hard")[]
): T[] {
  const byDifficulty: Record<"easy" | "medium" | "hard", T[]> = {
    easy: shuffle(pool.filter((q) => q.difficulty === "easy")),
    medium: shuffle(pool.filter((q) => q.difficulty === "medium")),
    hard: shuffle(pool.filter((q) => q.difficulty === "hard")),
  };

  const selected: T[] = [];
  for (const diff of sequence) {
    const next = byDifficulty[diff].shift();
    if (next) selected.push(next);
  }
  return selected;
}

onboardingRoutes.post("/choice", async (c) => {
  const body = onboardingChoiceSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const userId = c.get("userId");

  // Stamped regardless of choice - the popup is a one-time prompt, not
  // something that should reappear just because the user picked "new".
  await prisma.user.update({ where: { id: userId }, data: { onboardingPromptSeenAt: new Date() } });

  if (body.data.choice === "new") {
    return c.json({ ok: true });
  }

  const ccaf = await prisma.certification.findUniqueOrThrow({ where: { code: "CCAF" } });
  const ccap = await prisma.certification.findUnique({ where: { code: "CCAP" } });

  const ccafPool = await fetchPool(ccaf.id, userId);
  const ccapPool = ccap ? await fetchPool(ccap.id, userId) : [];

  // Foundations block first, professional-tier block appended after - order
  // matters here (unlike the weighted-random "mixed" exam type), since the
  // second block is what tells the user whether they're ready for CCAR-P.
  const selected = [
    ...buildAssessmentOrder(ccafPool, CCAF_SEQUENCE),
    ...buildAssessmentOrder(ccapPool, CCAP_SEQUENCE),
  ];
  if (selected.length === 0) {
    return c.json({ error: "No approved questions available yet for an assessment." }, 422);
  }

  const exam = await prisma.exam.create({
    data: {
      userId,
      certificationId: ccaf.id,
      feedbackMode: "end_of_set",
      difficulty: "mixed",
      isAssessment: true,
      questionCount: selected.length,
      examQuestions: {
        create: selected.map((q, i) => ({ questionId: q.id, orderIndex: i })),
      },
    },
  });

  return c.json({ ok: true, examId: exam.id });
});
