import { Hono } from "hono";
import { prisma } from "@claude-cert/db";
import { createExamSchema, submitAnswerSchema } from "@claude-cert/shared";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware.ts";
import { decrypt } from "../lib/crypto.ts";
import { generateAssessmentSummary } from "../lib/anthropicSummary.ts";
import { shuffle } from "../lib/shuffle.ts";
import { domainWeightsForCert } from "../lib/domainWeights.ts";
import { selectByDomain, selectMixed } from "../lib/questionSelection.ts";

export const examRoutes = new Hono<{ Variables: AuthedVars }>();
examRoutes.use("*", requireAuth);

examRoutes.post("/", async (c) => {
  const body = createExamSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { certification, difficulty, questionCount, topicScope } = body.data;
  const userId = c.get("userId");

  const cert = await prisma.certification.findUnique({ where: { code: certification.toUpperCase() } });
  if (!cert) return c.json({ error: "Unknown certification" }, 404);

  const pool = await prisma.question.findMany({
    where: {
      certificationId: cert.id,
      isActive: true,
      // Approved questions from anyone, plus the requester's own pending
      // ones - a user can practice with content they just generated/uploaded
      // before it's reviewed, it just doesn't leak into the shared pool for
      // everyone else (spec Section 11).
      OR: [{ reviewStatus: "approved" }, { reviewStatus: "pending", createdBy: userId }],
      ...(difficulty !== "mixed" ? { difficulty } : {}),
      ...(topicScope ? { topicId: topicScope } : {}),
    },
    select: { id: true, difficulty: true, topic: { select: { examDomain: true } } },
  });

  // Domain-weighted selection only makes sense across a whole certification -
  // a single-topic practice run (topicScope) is inherently confined to that
  // topic's one domain already.
  const domainWeights = topicScope ? null : domainWeightsForCert(cert.code);
  const selected = domainWeights
    ? selectByDomain(pool, questionCount, difficulty, domainWeights)
    : difficulty === "mixed"
      ? selectMixed(pool, questionCount)
      : shuffle(pool).slice(0, questionCount);
  if (selected.length === 0) {
    return c.json({ error: "No approved questions match this setup yet." }, 422);
  }

  const exam = await prisma.exam.create({
    data: {
      userId,
      certificationId: cert.id,
      // Per-question reveal is gone in favor of a single feedback pass at
      // the end of the exam (see GET /:id/results) - every exam is created
      // as "end_of_set" now, there's no user-facing choice anymore.
      feedbackMode: "end_of_set",
      difficulty,
      topicScope: topicScope ?? null,
      questionCount: selected.length,
      examQuestions: {
        create: selected.map((q, i) => ({ questionId: q.id, orderIndex: i })),
      },
    },
  });

  return c.json({
    examId: exam.id,
    requestedCount: questionCount,
    actualCount: selected.length,
  });
});

examRoutes.get("/:id", async (c) => {
  const examId = c.req.param("id");
  const userId = c.get("userId");

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: {
      examQuestions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: { include: { options: { orderBy: { orderIndex: "asc" } } } },
        },
      },
    },
  });
  if (!exam) return c.json({ error: "Exam not found" }, 404);

  return c.json({
    id: exam.id,
    feedbackMode: exam.feedbackMode,
    difficulty: exam.difficulty,
    questionCount: exam.questionCount,
    completedAt: exam.completedAt,
    questions: exam.examQuestions.map((eq) => ({
      questionId: eq.question.id,
      orderIndex: eq.orderIndex,
      questionText: eq.question.questionText,
      options: eq.question.options.map((o) => ({ id: o.id, optionText: o.optionText })),
      selectedOptionId: eq.selectedOptionId,
      // Correctness/explanations are only revealed once the whole exam is
      // complete - no more per-question reveal while the exam is in progress.
      ...(exam.completedAt
        ? {
            isCorrect: eq.isCorrect,
            correctOptionId: eq.question.options.find((o) => o.isCorrect)?.id,
            explanations: Object.fromEntries(eq.question.options.map((o) => [o.id, o.explanation])),
          }
        : {}),
    })),
  });
});

examRoutes.post("/:id/questions/:questionId/answer", async (c) => {
  const examId = c.req.param("id");
  const questionId = c.req.param("questionId");
  const userId = c.get("userId");

  const body = submitAnswerSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const exam = await prisma.exam.findFirst({ where: { id: examId, userId } });
  if (!exam) return c.json({ error: "Exam not found" }, 404);
  if (exam.completedAt) return c.json({ error: "Exam already completed" }, 400);

  const examQuestion = await prisma.examQuestion.findFirst({
    where: { examId, questionId },
    include: { question: { include: { options: true } } },
  });
  if (!examQuestion) return c.json({ error: "Question not in this exam" }, 404);

  const selectedOption = examQuestion.question.options.find((o) => o.id === body.data.selectedOptionId);
  if (!selectedOption) return c.json({ error: "Option not found for this question" }, 400);

  await prisma.examQuestion.update({
    where: { id: examQuestion.id },
    data: {
      selectedOptionId: selectedOption.id,
      isCorrect: selectedOption.isCorrect,
      answeredAt: new Date(),
    },
  });

  // No per-question reveal - correctness and explanations only show up in
  // the end-of-exam results (GET /:id/results).
  return c.json({ ok: true });
});

examRoutes.post("/:id/complete", async (c) => {
  const examId = c.req.param("id");
  const userId = c.get("userId");

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: { examQuestions: true },
  });
  if (!exam) return c.json({ error: "Exam not found" }, 404);
  if (exam.completedAt) return c.json({ error: "Exam already completed" }, 400);

  const answered = exam.examQuestions.filter((eq) => eq.answeredAt !== null);
  const correct = answered.filter((eq) => eq.isCorrect).length;
  const scorePct = exam.examQuestions.length === 0 ? 0 : (correct / exam.examQuestions.length) * 100;

  await prisma.exam.update({
    where: { id: exam.id },
    data: { completedAt: new Date(), scorePct },
  });

  return c.json({ ok: true, scorePct });
});

examRoutes.get("/:id/results", async (c) => {
  const examId = c.req.param("id");
  const userId = c.get("userId");

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: {
      examQuestions: {
        orderBy: { orderIndex: "asc" },
        include: { question: { include: { options: true, topic: true, certification: true } } },
      },
    },
  });
  if (!exam) return c.json({ error: "Exam not found" }, 404);
  if (!exam.completedAt) return c.json({ error: "Exam not completed yet" }, 400);

  const byTopic = new Map<string, { title: string; certCode: string; correct: number; total: number }>();
  const byDifficulty = new Map<string, { correct: number; total: number }>();
  const byCertification = new Map<string, { name: string; correct: number; total: number }>();
  const missed: Array<{
    questionId: string;
    questionText: string;
    topicId: string;
    topicTitle: string;
    certCode: string;
    selectedOptionId: string | null;
    options: Array<{ id: string; optionText: string; isCorrect: boolean; explanation: string }>;
  }> = [];

  for (const eq of exam.examQuestions) {
    const certCode = eq.question.certification.code.toLowerCase();

    const topicKey = eq.question.topicId;
    const topicEntry = byTopic.get(topicKey) ?? { title: eq.question.topic.title, certCode, correct: 0, total: 0 };
    topicEntry.total++;
    if (eq.isCorrect) topicEntry.correct++;
    byTopic.set(topicKey, topicEntry);

    const diffEntry = byDifficulty.get(eq.question.difficulty) ?? { correct: 0, total: 0 };
    diffEntry.total++;
    if (eq.isCorrect) diffEntry.correct++;
    byDifficulty.set(eq.question.difficulty, diffEntry);

    const certKey = eq.question.certification.code;
    const certEntry = byCertification.get(certKey) ?? { name: eq.question.certification.name, correct: 0, total: 0 };
    certEntry.total++;
    if (eq.isCorrect) certEntry.correct++;
    byCertification.set(certKey, certEntry);

    if (!eq.isCorrect) {
      missed.push({
        questionId: eq.question.id,
        questionText: eq.question.questionText,
        topicId: eq.question.topicId,
        topicTitle: eq.question.topic.title,
        certCode,
        selectedOptionId: eq.selectedOptionId,
        // Full per-option breakdown (right and wrong) - this is now the only
        // place a completed exam explains "why", since there's no more
        // per-question reveal while answering.
        options: eq.question.options.map((o) => ({
          id: o.id,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          explanation: o.explanation,
        })),
      });
    }
  }

  return c.json({
    // Prisma's Decimal serializes to a string by default - cast to a plain
    // number so the frontend can call .toFixed() on it directly.
    scorePct: exam.scorePct ? Number(exam.scorePct) : 0,
    isAssessment: exam.isAssessment,
    byTopic: Array.from(byTopic.entries()).map(([topicId, v]) => ({ topicId, ...v })),
    byDifficulty: Array.from(byDifficulty.entries()).map(([difficulty, v]) => ({ difficulty, ...v })),
    byCertification: Array.from(byCertification.entries()).map(([code, v]) => ({ code, ...v })),
    missed,
  });
});

// On-demand, regenerable AI narrative summary of a completed exam - requires
// the requesting user to have a saved Anthropic API key, same gate as
// questions.ts's /generate.
examRoutes.post("/:id/ai-summary", async (c) => {
  const examId = c.req.param("id");
  const userId = c.get("userId");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.anthropicApiKeyEnc || !user.anthropicApiKeyIv) {
    return c.json({ error: "Save an Anthropic API key in your profile first." }, 400);
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: {
      certification: true,
      examQuestions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: { include: { options: true, topic: true, certification: true } },
          selectedOption: true,
        },
      },
    },
  });
  if (!exam) return c.json({ error: "Exam not found" }, 404);
  if (!exam.completedAt) return c.json({ error: "Exam not completed yet" }, 400);

  const items = exam.examQuestions.map((eq) => ({
    certification: eq.question.certification.name,
    topic: eq.question.topic.title,
    difficulty: eq.question.difficulty,
    questionText: eq.question.questionText,
    chosenText: eq.selectedOption?.optionText ?? "(not answered)",
    correctText: eq.question.options.find((o) => o.isCorrect)?.optionText ?? "",
    isCorrect: eq.isCorrect ?? false,
  }));

  const examLabel = exam.isAssessment
    ? "a placement assessment spanning the Foundations (CCAR-F) and Professional (CCAR-P) tiers"
    : `an exam for the "${exam.certification.name}" certification`;

  const apiKey = decrypt({
    ciphertext: Buffer.from(user.anthropicApiKeyEnc),
    iv: Buffer.from(user.anthropicApiKeyIv),
  });

  try {
    const result = await generateAssessmentSummary({
      apiKey,
      examLabel,
      items,
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Summary generation failed" }, 502);
  }
});
