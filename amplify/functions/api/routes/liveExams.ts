import { Hono } from "hono";
import { prisma, Prisma } from "@claude-cert/db";
import { createLiveExamSchema, liveExamSubmitAnswerSchema } from "@claude-cert/shared";
import { requireAuth, requireAdmin, type AuthedVars } from "../lib/authMiddleware.ts";
import { shuffle } from "../lib/shuffle.ts";
import { broadcastToLiveExam } from "../lib/liveExamBroadcast.ts";

export const liveExamRoutes = new Hono<{ Variables: AuthedVars }>();
liveExamRoutes.use("*", requireAuth);

async function isHostOrParticipant(liveExamId: string, userId: string, hostId: string): Promise<boolean> {
  if (userId === hostId) return true;
  const participant = await prisma.liveExamParticipant.findUnique({
    where: { liveExamId_userId: { liveExamId, userId } },
  });
  return !!participant;
}

async function broadcastQuestion(liveExamId: string, index: number): Promise<void> {
  const liveExam = await prisma.liveExam.findUnique({ where: { id: liveExamId } });
  const leq = await prisma.liveExamQuestion.findFirst({
    where: { liveExamId, orderIndex: index },
    include: { question: { include: { options: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!liveExam || !leq) return;
  const total = await prisma.liveExamQuestion.count({ where: { liveExamId } });

  await broadcastToLiveExam(liveExamId, {
    type: "question",
    index,
    total,
    phaseStartedAt: liveExam.phaseStartedAt,
    answerSeconds: liveExam.answerSeconds,
    question: {
      questionId: leq.question.id,
      questionText: leq.question.questionText,
      difficulty: leq.question.difficulty,
      options: leq.question.options.map((o) => ({ id: o.id, optionText: o.optionText })),
    },
  });
}

async function broadcastReveal(liveExamId: string): Promise<void> {
  const liveExam = await prisma.liveExam.findUnique({ where: { id: liveExamId } });
  if (!liveExam) return;
  const leq = await prisma.liveExamQuestion.findFirst({
    where: { liveExamId, orderIndex: liveExam.currentIndex },
    include: { question: { include: { options: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!leq) return;

  await broadcastToLiveExam(liveExamId, {
    type: "reveal",
    phaseStartedAt: liveExam.phaseStartedAt,
    revealSeconds: liveExam.revealSeconds,
    correctOptionId: leq.question.options.find((o) => o.isCorrect)?.id,
    explanations: Object.fromEntries(leq.question.options.map((o) => [o.id, o.explanation])),
  });
}

// Admin/super_admin only - matches the existing content-curation permission tier.
liveExamRoutes.post("/", requireAdmin, async (c) => {
  const body = createLiveExamSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { certification, difficulty, questionCount, answerSeconds, revealSeconds, topicScope } = body.data;
  const hostId = c.get("userId");

  const cert = await prisma.certification.findUnique({ where: { code: certification.toUpperCase() } });
  if (!cert) return c.json({ error: "Unknown certification" }, 404);

  // Approved content only (no own-pending-content carve-out like /exams has) -
  // a live session is shared with many people, not a solo practice run.
  const pool = await prisma.question.findMany({
    where: {
      certificationId: cert.id,
      isActive: true,
      reviewStatus: "approved",
      ...(difficulty !== "mixed" ? { difficulty } : {}),
      ...(topicScope ? { topicId: topicScope } : {}),
    },
    select: { id: true },
  });

  const selected = shuffle(pool).slice(0, questionCount);
  if (selected.length === 0) {
    return c.json({ error: "No approved questions match this setup yet." }, 422);
  }

  const liveExam = await prisma.liveExam.create({
    data: {
      certificationId: cert.id,
      topicScope: topicScope ?? null,
      difficulty,
      requestedCount: questionCount,
      answerSeconds,
      revealSeconds,
      hostId,
      questions: {
        create: selected.map((q, i) => ({ questionId: q.id, orderIndex: i })),
      },
    },
  });

  return c.json({ id: liveExam.id, actualCount: selected.length });
});

liveExamRoutes.get("/", async (c) => {
  const sessions = await prisma.liveExam.findMany({
    where: { phase: { notIn: ["completed", "cancelled"] } },
    include: { certification: true, _count: { select: { participants: true, questions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    liveExams: sessions.map((s) => ({
      id: s.id,
      certification: s.certification.code,
      certificationName: s.certification.name,
      difficulty: s.difficulty,
      phase: s.phase,
      questionCount: s._count.questions,
      participantCount: s._count.participants,
      hostId: s.hostId,
    })),
  });
});

liveExamRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const liveExam = await prisma.liveExam.findUnique({
    where: { id },
    include: {
      certification: true,
      questions: {
        orderBy: { orderIndex: "asc" },
        include: { question: { include: { options: { orderBy: { orderIndex: "asc" } } } } },
      },
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);

  const isHost = liveExam.hostId === userId;
  const participant = liveExam.participants.find((p) => p.userId === userId);
  const currentLEQ = liveExam.questions[liveExam.currentIndex];

  let currentQuestion = null;
  let myAnswer = null;
  if (currentLEQ) {
    const revealed = liveExam.phase === "reveal" || liveExam.phase === "completed";
    currentQuestion = {
      questionId: currentLEQ.question.id,
      questionText: currentLEQ.question.questionText,
      difficulty: currentLEQ.question.difficulty,
      options: currentLEQ.question.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        ...(revealed ? { isCorrect: o.isCorrect, explanation: o.explanation } : {}),
      })),
    };

    if (participant) {
      const ans = await prisma.liveExamAnswer.findUnique({
        where: { liveExamQuestionId_participantId: { liveExamQuestionId: currentLEQ.id, participantId: participant.id } },
      });
      myAnswer = ans ? { selectedOptionId: ans.selectedOptionId, isCorrect: ans.isCorrect } : null;
    }
  }

  let progress = null;
  if (isHost && currentLEQ) {
    const answeredCount = await prisma.liveExamAnswer.count({ where: { liveExamQuestionId: currentLEQ.id } });
    progress = { answeredCount, totalParticipants: liveExam.participants.length };
  }

  return c.json({
    id: liveExam.id,
    certificationName: liveExam.certification.name,
    difficulty: liveExam.difficulty,
    phase: liveExam.phase,
    currentIndex: liveExam.currentIndex,
    totalQuestions: liveExam.questions.length,
    phaseStartedAt: liveExam.phaseStartedAt,
    answerSeconds: liveExam.answerSeconds,
    revealSeconds: liveExam.revealSeconds,
    isHost,
    joined: !!participant,
    currentQuestion,
    myAnswer,
    progress,
    roster: liveExam.participants.map((p) => ({ userId: p.userId, name: p.user.name })),
  });
});

liveExamRoutes.post("/:id/join", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const liveExam = await prisma.liveExam.findUnique({ where: { id } });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);
  if (liveExam.phase === "completed" || liveExam.phase === "cancelled") {
    return c.json({ error: "This live exam has ended" }, 400);
  }

  await prisma.liveExamParticipant.upsert({
    where: { liveExamId_userId: { liveExamId: id, userId } },
    update: {},
    create: { liveExamId: id, userId },
  });

  const roster = await prisma.liveExamParticipant.findMany({
    where: { liveExamId: id },
    include: { user: { select: { id: true, name: true } } },
  });
  await broadcastToLiveExam(id, {
    type: "roster",
    roster: roster.map((p) => ({ userId: p.userId, name: p.user.name })),
  });

  return c.json({ ok: true });
});

liveExamRoutes.post("/:id/start", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const liveExam = await prisma.liveExam.findUnique({ where: { id } });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);
  if (liveExam.hostId !== userId) return c.json({ error: "Only the host can start this session" }, 403);

  const result = await prisma.liveExam.updateMany({
    where: { id, phase: "lobby" },
    data: { phase: "question", currentIndex: 0, phaseStartedAt: new Date(), startedAt: new Date() },
  });
  if (result.count === 0) return c.json({ error: "Session already started" }, 400);

  await broadcastQuestion(id, 0);
  return c.json({ ok: true });
});

liveExamRoutes.post("/:id/questions/:questionId/answer", async (c) => {
  const id = c.req.param("id");
  const questionId = c.req.param("questionId");
  const userId = c.get("userId");

  const body = liveExamSubmitAnswerSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const liveExam = await prisma.liveExam.findUnique({ where: { id } });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);
  if (liveExam.phase !== "question") return c.json({ error: "Not accepting answers right now" }, 400);

  const deadline = liveExam.phaseStartedAt ? liveExam.phaseStartedAt.getTime() + liveExam.answerSeconds * 1000 : 0;
  if (Date.now() > deadline) return c.json({ error: "Time's up" }, 400);

  const participant = await prisma.liveExamParticipant.findUnique({
    where: { liveExamId_userId: { liveExamId: id, userId } },
  });
  if (!participant) return c.json({ error: "You haven't joined this session" }, 403);

  const leq = await prisma.liveExamQuestion.findFirst({
    where: { liveExamId: id, questionId, orderIndex: liveExam.currentIndex },
    include: { question: { include: { options: true } } },
  });
  if (!leq) return c.json({ error: "Question not found for this session" }, 404);

  const option = leq.question.options.find((o) => o.id === body.data.selectedOptionId);
  if (!option) return c.json({ error: "Option not found" }, 400);

  try {
    await prisma.liveExamAnswer.create({
      data: {
        liveExamQuestionId: leq.id,
        participantId: participant.id,
        selectedOptionId: option.id,
        isCorrect: option.isCorrect,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return c.json({ error: "Already answered" }, 409);
    }
    throw err;
  }

  const [answeredCount, totalParticipants] = await Promise.all([
    prisma.liveExamAnswer.count({ where: { liveExamQuestionId: leq.id } }),
    prisma.liveExamParticipant.count({ where: { liveExamId: id } }),
  ]);
  await broadcastToLiveExam(id, { type: "progress", answeredCount, totalParticipants });

  return c.json({ ok: true });
});

// Hit by both the host's manual "Reveal now" button and every client's own
// auto-timeout - the conditional update means only the first caller actually
// transitions the phase and triggers a broadcast; everyone else no-ops.
liveExamRoutes.post("/:id/reveal", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const liveExam = await prisma.liveExam.findUnique({ where: { id } });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);
  if (!(await isHostOrParticipant(id, userId, liveExam.hostId))) return c.json({ error: "Forbidden" }, 403);

  const result = await prisma.liveExam.updateMany({
    where: { id, phase: "question" },
    data: { phase: "reveal", phaseStartedAt: new Date() },
  });
  if (result.count === 1) await broadcastReveal(id);

  return c.json({ ok: true, transitioned: result.count === 1 });
});

// Same manual-or-auto shape as /reveal.
liveExamRoutes.post("/:id/next", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const liveExam = await prisma.liveExam.findUnique({ where: { id }, include: { questions: true } });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);
  if (!(await isHostOrParticipant(id, userId, liveExam.hostId))) return c.json({ error: "Forbidden" }, 403);

  const total = liveExam.questions.length;
  const isLast = liveExam.currentIndex >= total - 1;

  if (isLast) {
    const result = await prisma.liveExam.updateMany({
      where: { id, phase: "reveal" },
      data: { phase: "completed", completedAt: new Date() },
    });
    if (result.count === 1) await broadcastToLiveExam(id, { type: "completed" });
    return c.json({ ok: true, transitioned: result.count === 1 });
  }

  const nextIndex = liveExam.currentIndex + 1;
  const result = await prisma.liveExam.updateMany({
    where: { id, phase: "reveal" },
    data: { phase: "question", currentIndex: nextIndex, phaseStartedAt: new Date() },
  });
  if (result.count === 1) await broadcastQuestion(id, nextIndex);

  return c.json({ ok: true, transitioned: result.count === 1 });
});

liveExamRoutes.post("/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const liveExam = await prisma.liveExam.findUnique({ where: { id } });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);
  if (liveExam.hostId !== userId) return c.json({ error: "Only the host can cancel this session" }, 403);

  await prisma.liveExam.update({ where: { id }, data: { phase: "cancelled" } });
  await broadcastToLiveExam(id, { type: "cancelled" });

  return c.json({ ok: true });
});

liveExamRoutes.get("/:id/results", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const liveExam = await prisma.liveExam.findUnique({ where: { id } });
  if (!liveExam) return c.json({ error: "Live exam not found" }, 404);
  if (liveExam.phase !== "completed") return c.json({ error: "Session not completed yet" }, 400);

  const participant = await prisma.liveExamParticipant.findUnique({
    where: { liveExamId_userId: { liveExamId: id, userId } },
    include: {
      answers: {
        include: { liveExamQuestion: { include: { question: { include: { topic: true } } } } },
      },
    },
  });
  if (!participant) return c.json({ error: "You didn't participate in this session" }, 404);

  const totalQuestions = await prisma.liveExamQuestion.count({ where: { liveExamId: id } });
  const answeredCorrect = participant.answers.filter((a) => a.isCorrect).length;

  const byTopic = new Map<string, { title: string; correct: number; total: number }>();
  const byDifficulty = new Map<string, { correct: number; total: number }>();

  for (const a of participant.answers) {
    const topicTitle = a.liveExamQuestion.question.topic.title;
    const topicEntry = byTopic.get(topicTitle) ?? { title: topicTitle, correct: 0, total: 0 };
    topicEntry.total++;
    if (a.isCorrect) topicEntry.correct++;
    byTopic.set(topicTitle, topicEntry);

    const difficulty = a.liveExamQuestion.question.difficulty;
    const diffEntry = byDifficulty.get(difficulty) ?? { correct: 0, total: 0 };
    diffEntry.total++;
    if (a.isCorrect) diffEntry.correct++;
    byDifficulty.set(difficulty, diffEntry);
  }

  return c.json({
    scorePct: totalQuestions === 0 ? 0 : Math.round((answeredCorrect / totalQuestions) * 100),
    answeredCorrect,
    totalQuestions,
    byTopic: Array.from(byTopic.values()),
    byDifficulty: Array.from(byDifficulty.entries()).map(([difficulty, v]) => ({ difficulty, ...v })),
  });
});
