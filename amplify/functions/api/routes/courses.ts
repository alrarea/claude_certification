import { Hono } from "hono";
import { prisma, type Topic } from "@claude-cert/db";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware.ts";

export const courseRoutes = new Hono<{ Variables: AuthedVars }>();
courseRoutes.use("*", requireAuth);

interface TopicNode {
  id: string;
  title: string;
  orderIndex: number;
  examDomain: string | null;
  status: string;
  children: TopicNode[];
}

courseRoutes.get("/:cert/topics", async (c) => {
  const certCode = c.req.param("cert").toUpperCase();
  const userId = c.get("userId");

  const certification = await prisma.certification.findUnique({ where: { code: certCode } });
  if (!certification) return c.json({ error: "Unknown certification" }, 404);

  const [topics, progress] = await Promise.all([
    prisma.topic.findMany({
      where: { certificationId: certification.id },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.userTopicProgress.findMany({ where: { userId } }),
  ]);

  const progressByTopic = new Map<string, string>(progress.map((p) => [p.topicId, p.status]));
  const byId = new Map<string, TopicNode>();
  for (const t of topics) {
    byId.set(t.id, {
      id: t.id,
      title: t.title,
      orderIndex: t.orderIndex,
      examDomain: t.examDomain,
      status: progressByTopic.get(t.id) ?? "not_started",
      children: [],
    });
  }

  const roots: TopicNode[] = [];
  for (const t of topics) {
    const node = byId.get(t.id)!;
    if (t.parentTopicId && byId.has(t.parentTopicId)) {
      byId.get(t.parentTopicId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const isLeaf = (t: Topic) => !topics.some((other: Topic) => other.parentTopicId === t.id);
  const leafCount = topics.filter(isLeaf).length;
  const completedCount = topics.filter(
    (t: Topic) => isLeaf(t) && progressByTopic.get(t.id) === "completed"
  ).length;

  return c.json({
    certification: { code: certification.code, name: certification.name },
    topics: roots,
    percentComplete: leafCount === 0 ? 0 : Math.round((completedCount / leafCount) * 100),
  });
});

courseRoutes.get("/:cert/topics/:topicId", async (c) => {
  const topicId = c.req.param("topicId");
  const mode = (c.req.query("mode") ?? "normal") as "in_depth" | "normal" | "concise";
  const userId = c.get("userId");

  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return c.json({ error: "Topic not found" }, 404);

  const content = await prisma.topicContent.findUnique({
    where: { topicId_mode: { topicId, mode } },
  });

  const progress = await prisma.userTopicProgress.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: {
      status: "in_progress",
      lastMode: mode,
      lastViewedAt: new Date(),
    },
    create: {
      userId,
      topicId,
      status: "in_progress",
      lastMode: mode,
      lastViewedAt: new Date(),
    },
  });

  return c.json({
    topic: { id: topic.id, title: topic.title, examDomain: topic.examDomain },
    mode,
    contentMd: content?.contentMd ?? null,
    available: content !== null,
    progressStatus: progress.status,
  });
});

courseRoutes.post("/:cert/topics/:topicId/progress", async (c) => {
  const topicId = c.req.param("topicId");
  const userId = c.get("userId");

  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return c.json({ error: "Topic not found" }, 404);

  const progress = await prisma.userTopicProgress.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: { status: "completed" },
    create: { userId, topicId, status: "completed" },
  });

  return c.json({ status: progress.status });
});
