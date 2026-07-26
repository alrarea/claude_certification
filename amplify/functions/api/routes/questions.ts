import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { prisma } from "@claude-cert/db";
import {
  createQuestionSchema,
  generateQuestionsSchema,
  reviewQuestionSchema,
  uploadDocumentSchema,
  MAX_AI_GENERATIONS_PER_DAY,
} from "@claude-cert/shared";
import { requireAuth, requireAdmin, type AuthedVars } from "../lib/authMiddleware.ts";
import { decrypt } from "../lib/crypto.ts";
import { generateQuestions, type GeneratedQuestion } from "../lib/anthropicGenerate.ts";
import { isOptionLengthBalanced } from "../lib/optionBalance.ts";
import { uploadDocument } from "../lib/s3.ts";
import { extractDocumentText } from "../lib/extractDocumentText.ts";

export const questionRoutes = new Hono<{ Variables: AuthedVars }>();
questionRoutes.use("*", requireAuth);

async function insertGeneratedQuestions(params: {
  certificationId: string;
  userId: string;
  questions: GeneratedQuestion[];
  validTopicIds: Set<string>;
}): Promise<string[]> {
  const created: string[] = [];
  for (const q of params.questions) {
    if (!params.validTopicIds.has(q.topicId)) continue;
    if (q.options.length !== 4 || q.options.filter((o) => o.isCorrect).length !== 1) continue;

    const question = await prisma.question.create({
      data: {
        certificationId: params.certificationId,
        topicId: q.topicId,
        difficulty: q.difficulty,
        questionText: q.questionText,
        source: "ai_generated",
        createdBy: params.userId,
        reviewStatus: "pending",
        options: {
          create: q.options.map((o, i) => ({
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            explanation: o.explanation,
            orderIndex: i,
          })),
        },
      },
    });
    created.push(question.id);
  }
  return created;
}

// Manual authoring - admin/super_admin only, approved immediately.
questionRoutes.post("/", requireAdmin, async (c) => {
  const body = createQuestionSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { certification, topicId, difficulty, questionText, options } = body.data;
  const userId = c.get("userId");

  const cert = await prisma.certification.findUnique({ where: { code: certification.toUpperCase() } });
  if (!cert) return c.json({ error: "Unknown certification" }, 404);

  if (options.filter((o) => o.isCorrect).length !== 1) {
    return c.json({ error: "Exactly one option must be marked correct" }, 400);
  }

  const balanced = isOptionLengthBalanced(options);

  const question = await prisma.question.create({
    data: {
      certificationId: cert.id,
      topicId,
      difficulty,
      questionText,
      source: "manual",
      createdBy: userId,
      reviewStatus: "approved",
      options: {
        create: options.map((o, i) => ({
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          explanation: o.explanation,
          orderIndex: i,
        })),
      },
    },
  });

  return c.json({ id: question.id, optionLengthBalanced: balanced });
});

// Admin review queue.
questionRoutes.get("/pending", requireAdmin, async (c) => {
  const pending = await prisma.question.findMany({
    where: { reviewStatus: "pending" },
    include: { options: { orderBy: { orderIndex: "asc" } }, topic: true, certification: true },
    orderBy: { createdAt: "asc" },
  });

  return c.json({
    questions: pending.map((q) => ({
      id: q.id,
      certification: q.certification.code,
      topicTitle: q.topic.title,
      difficulty: q.difficulty,
      source: q.source,
      questionText: q.questionText,
      createdAt: q.createdAt,
      options: q.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        isCorrect: o.isCorrect,
        explanation: o.explanation,
      })),
    })),
  });
});

questionRoutes.post("/:id/review", requireAdmin, async (c) => {
  const questionId = c.req.param("id");
  const body = reviewQuestionSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) return c.json({ error: "Question not found" }, 404);

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: {
      reviewStatus: body.data.decision,
      isActive: body.data.decision === "approved",
    },
  });

  return c.json({ id: updated.id, reviewStatus: updated.reviewStatus });
});

// Generate a fresh set on demand - requires the requesting user to have a
// saved Anthropic API key (spec Section 11B).
questionRoutes.post("/generate", async (c) => {
  const body = generateQuestionsSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { certification, topicId, difficulty, count } = body.data;
  const userId = c.get("userId");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.anthropicApiKeyEnc || !user.anthropicApiKeyIv) {
    return c.json({ error: "Save an Anthropic API key in your profile first." }, 400);
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const generatedToday = await prisma.question.count({
    where: { createdBy: userId, source: "ai_generated", createdAt: { gte: dayAgo } },
  });
  if (generatedToday + count > MAX_AI_GENERATIONS_PER_DAY) {
    return c.json({ error: `Daily AI-generation limit (${MAX_AI_GENERATIONS_PER_DAY}) reached.` }, 429);
  }

  const cert = await prisma.certification.findUnique({ where: { code: certification.toUpperCase() } });
  if (!cert) return c.json({ error: "Unknown certification" }, 404);

  const topics = await prisma.topic.findMany({
    where: { certificationId: cert.id, ...(topicId ? { id: topicId } : {}) },
    select: { id: true, title: true },
  });
  if (topics.length === 0) return c.json({ error: "No topics found to generate against" }, 400);

  const apiKey = decrypt({
    ciphertext: Buffer.from(user.anthropicApiKeyEnc),
    iv: Buffer.from(user.anthropicApiKeyIv),
  });

  let generated;
  try {
    generated = await generateQuestions({
      apiKey,
      certificationName: cert.name,
      topics,
      difficulty,
      count,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Generation failed" }, 502);
  }

  const validTopicIds = new Set(topics.map((t) => t.id));
  const created = await insertGeneratedQuestions({
    certificationId: cert.id,
    userId,
    questions: generated,
    validTopicIds,
  });

  return c.json({ createdCount: created.length, questionIds: created });
});

// Upload a source document (PDF/DOCX/HTML) - stored in S3 regardless; if the
// user has a saved Anthropic key, candidate questions are generated from its
// extracted text (source='ai_generated', review_status='pending', same as
// on-demand generation). Without a key, the document is stored for an admin
// to pull content from manually - spec Section 11A.
questionRoutes.post("/upload", async (c) => {
  const body = uploadDocumentSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { certification, filename, contentBase64 } = body.data;
  const userId = c.get("userId");

  const cert = await prisma.certification.findUnique({ where: { code: certification.toUpperCase() } });
  if (!cert) return c.json({ error: "Unknown certification" }, 404);

  const buffer = Buffer.from(contentBase64, "base64");
  const storageKey = `${cert.code}/${userId}/${randomUUID()}-${filename}`;

  const upload = await prisma.documentUpload.create({
    data: { userId, filename, storagePath: storageKey, status: "processing" },
  });

  try {
    await uploadDocument(storageKey, buffer, "application/octet-stream");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    let generatedCount = 0;

    if (user.anthropicApiKeyEnc && user.anthropicApiKeyIv) {
      const sourceContent = await extractDocumentText(buffer, filename);
      const topics = await prisma.topic.findMany({
        where: { certificationId: cert.id },
        select: { id: true, title: true },
      });
      const apiKey = decrypt({
        ciphertext: Buffer.from(user.anthropicApiKeyEnc),
        iv: Buffer.from(user.anthropicApiKeyIv),
      });
      const generated = await generateQuestions({
        apiKey,
        certificationName: cert.name,
        topics,
        difficulty: "mixed",
        count: Math.min(10, topics.length * 2),
        sourceContent,
      });
      const created = await insertGeneratedQuestions({
        certificationId: cert.id,
        userId,
        questions: generated,
        validTopicIds: new Set(topics.map((t) => t.id)),
      });
      generatedCount = created.length;
    }

    await prisma.documentUpload.update({
      where: { id: upload.id },
      data: { status: "ready", generatedQuestionCt: generatedCount },
    });

    return c.json({ id: upload.id, status: "ready", generatedQuestionCt: generatedCount });
  } catch (err) {
    await prisma.documentUpload.update({ where: { id: upload.id }, data: { status: "failed" } });
    return c.json({ error: err instanceof Error ? err.message : "Upload processing failed" }, 502);
  }
});
