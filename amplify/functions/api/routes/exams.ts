import { Hono } from "hono";
import { prisma } from "@claude-cert/db";
import { createExamSchema, submitAnswerSchema } from "@claude-cert/shared";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware";

export const examRoutes = new Hono<{ Variables: AuthedVars }>();
examRoutes.use("*", requireAuth);

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

examRoutes.post("/", async (c) => {
  const body = createExamSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { certification, difficulty, feedbackMode, questionCount, topicScope } = body.data;
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
    select: { id: true },
  });

  const selected = shuffle(pool).slice(0, questionCount);
  if (selected.length === 0) {
    return c.json({ error: "No approved questions match this setup yet." }, 422);
  }

  const exam = await prisma.exam.create({
    data: {
      userId,
      certificationId: cert.id,
      feedbackMode,
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
      // Correctness/explanations only revealed once this question has been
      // answered under 'immediate' mode, or once the whole exam is complete.
      ...((eq.answeredAt && exam.feedbackMode === "immediate") || exam.completedAt
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

  if (exam.feedbackMode === "immediate") {
    return c.json({
      isCorrect: selectedOption.isCorrect,
      correctOptionId: examQuestion.question.options.find((o) => o.isCorrect)?.id,
      explanations: Object.fromEntries(examQuestion.question.options.map((o) => [o.id, o.explanation])),
    });
  }

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
        include: { question: { include: { options: true, topic: true } } },
      },
    },
  });
  if (!exam) return c.json({ error: "Exam not found" }, 404);
  if (!exam.completedAt) return c.json({ error: "Exam not completed yet" }, 400);

  const byTopic = new Map<string, { title: string; correct: number; total: number }>();
  const byDifficulty = new Map<string, { correct: number; total: number }>();
  const missed: Array<{ questionId: string; questionText: string; topicId: string; topicTitle: string }> = [];

  for (const eq of exam.examQuestions) {
    const topicKey = eq.question.topicId;
    const topicEntry = byTopic.get(topicKey) ?? { title: eq.question.topic.title, correct: 0, total: 0 };
    topicEntry.total++;
    if (eq.isCorrect) topicEntry.correct++;
    byTopic.set(topicKey, topicEntry);

    const diffEntry = byDifficulty.get(eq.question.difficulty) ?? { correct: 0, total: 0 };
    diffEntry.total++;
    if (eq.isCorrect) diffEntry.correct++;
    byDifficulty.set(eq.question.difficulty, diffEntry);

    if (!eq.isCorrect) {
      missed.push({
        questionId: eq.question.id,
        questionText: eq.question.questionText,
        topicId: eq.question.topicId,
        topicTitle: eq.question.topic.title,
      });
    }
  }

  return c.json({
    // Prisma's Decimal serializes to a string by default - cast to a plain
    // number so the frontend can call .toFixed() on it directly.
    scorePct: exam.scorePct ? Number(exam.scorePct) : 0,
    byTopic: Array.from(byTopic.entries()).map(([topicId, v]) => ({ topicId, ...v })),
    byDifficulty: Array.from(byDifficulty.entries()).map(([difficulty, v]) => ({ difficulty, ...v })),
    missed,
  });
});
