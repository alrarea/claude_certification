import { Hono } from "hono";
import { prisma } from "@claude-cert/db";
import { onboardingChoiceSchema } from "@claude-cert/shared";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware.ts";
import { CCAF_DOMAIN_WEIGHTS, CCAP_DOMAIN_WEIGHTS } from "../lib/domainWeights.ts";
import { selectByDomain } from "../lib/questionSelection.ts";

export const onboardingRoutes = new Hono<{ Variables: AuthedVars }>();
onboardingRoutes.use("*", requireAuth);

// Smallest counts where every domain's floor allocation is already >= 1
// (CCAF's thinnest domain is 15%, CCAP's is 7%) - below these, a
// deterministic domain-weighted draw would leave some domains at zero
// just from the block being too small to represent all of them.
const CCAF_ASSESSMENT_COUNT = 20;
const CCAP_ASSESSMENT_COUNT = 21;

async function fetchPool(certificationId: string, userId: string) {
  return prisma.question.findMany({
    where: {
      certificationId,
      isActive: true,
      OR: [{ reviewStatus: "approved" }, { reviewStatus: "pending", createdBy: userId }],
    },
    select: { id: true, difficulty: true, topic: { select: { examDomain: true } } },
  });
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

  // Foundations block first, professional-tier block appended after - the
  // second block's score is what the results page uses as the "ready for
  // CCAR-P?" signal. Each block is a real domain-weighted draw (same
  // allocator full exams use), not a difficulty-only sequence, so the mix
  // actually reflects the blueprint instead of just skewing toward whatever
  // domain has the most questions.
  const selected = [
    ...selectByDomain(ccafPool, CCAF_ASSESSMENT_COUNT, "mixed", CCAF_DOMAIN_WEIGHTS),
    ...selectByDomain(ccapPool, CCAP_ASSESSMENT_COUNT, "mixed", CCAP_DOMAIN_WEIGHTS),
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
