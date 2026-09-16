import { Hono } from "hono";
import { prisma, type Topic } from "@claude-cert/db";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware.ts";
import { DEFAULT_LOCALE, parseContentMode, parseLocale } from "@claude-cert/shared";

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

/**
 * The course in the order a reader actually moves through it: each section,
 * then that section's subtopics, then the next section.
 *
 * This is the same pre-order walk the course page renders, and it has to stay
 * that way - "next" means the row under this one on that page, so if the two
 * ever disagree the arrows start skipping topics. Both orderings come from
 * `orderIndex`, which is the one thing making them the same list.
 */
function readingOrder(topics: Topic[]): Topic[] {
  const byIndex = (a: Topic, b: Topic) => a.orderIndex - b.orderIndex;
  const childrenOf = new Map<string, Topic[]>();
  const roots: Topic[] = [];
  for (const topic of topics) {
    if (topic.parentTopicId) {
      const siblings = childrenOf.get(topic.parentTopicId) ?? [];
      siblings.push(topic);
      childrenOf.set(topic.parentTopicId, siblings);
    } else {
      roots.push(topic);
    }
  }
  const ordered: Topic[] = [];
  for (const root of roots.sort(byIndex)) {
    ordered.push(root);
    ordered.push(...(childrenOf.get(root.id) ?? []).sort(byIndex));
  }
  return ordered;
}

courseRoutes.get("/:cert/topics", async (c) => {
  const certCode = c.req.param("cert").toUpperCase();
  const userId = c.get("userId");

  const certification = await prisma.certification.findUnique({ where: { code: certCode } });
  if (!certification) return c.json({ error: "Unknown certification" }, 404);

  const locale = parseLocale(c.req.query("locale") ?? DEFAULT_LOCALE);
  if (!locale) return c.json({ error: "Unknown locale" }, 400);

  const [topics, progress] = await Promise.all([
    prisma.topic.findMany({
      where: { certificationId: certification.id },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.userTopicProgress.findMany({ where: { userId } }),
    // Every "view a course" path goes through this endpoint, so it's the
    // single natural write-point for "last viewed certification."
    prisma.user.update({ where: { id: userId }, data: { lastCertificationCode: certification.code } }),
  ]);

  // One query for the whole tree rather than a lookup per node. Absent rows
  // simply fall back to the base title, so a partially translated course tree
  // renders rather than half-failing.
  const [topicTitles, certTranslation] =
    locale === DEFAULT_LOCALE
      ? [[], null]
      : await Promise.all([
          prisma.topicTranslation.findMany({
            where: { topicId: { in: topics.map((t: Topic) => t.id) }, locale },
          }),
          prisma.certificationTranslation.findUnique({
            where: { certificationId_locale: { certificationId: certification.id, locale } },
          }),
        ]);
  const titleByTopic = new Map(topicTitles.map((t) => [t.topicId, t.title]));

  const progressByTopic = new Map<string, string>(progress.map((p) => [p.topicId, p.status]));
  const byId = new Map<string, TopicNode>();
  for (const t of topics) {
    byId.set(t.id, {
      id: t.id,
      title: titleByTopic.get(t.id) ?? t.title,
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
    certification: {
      code: certification.code,
      name: certTranslation?.name ?? certification.name,
    },
    locale,
    topics: roots,
    percentComplete: leafCount === 0 ? 0 : Math.round((completedCount / leafCount) * 100),
  });
});

courseRoutes.get("/:cert/topics/:topicId", async (c) => {
  const topicId = c.req.param("topicId");
  const userId = c.get("userId");

  // Validated, not cast. Both of these address a Postgres enum column, so an
  // unrecognised value used to reach the database and fail there as an
  // unhandled error rather than as a 400.
  const mode = parseContentMode(c.req.query("mode") ?? "normal");
  if (!mode) return c.json({ error: "Unknown content mode" }, 400);
  const locale = parseLocale(c.req.query("locale") ?? DEFAULT_LOCALE);
  if (!locale) return c.json({ error: "Unknown locale" }, 400);

  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return c.json({ error: "Topic not found" }, 404);

  // Neighbours are resolved here rather than on the client, which would
  // otherwise have to pull the whole course tree on every topic view - and
  // that endpoint writes `lastCertificationCode` as a side effect, so calling
  // it just to read an ordering would be a write per page view.
  const siblings = await prisma.topic.findMany({
    where: { certificationId: topic.certificationId },
    orderBy: { orderIndex: "asc" },
  });
  const ordered = readingOrder(siblings);
  const position = ordered.findIndex((t: Topic) => t.id === topicId);
  const prevTopic = position > 0 ? ordered[position - 1] : null;
  const nextTopic = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : null;

  // Ask for the requested language, fall back to the default one. The response
  // reports which was actually served, so the client can say "not translated
  // yet" instead of silently framing English content in a Malayalam shell.
  const requested = await prisma.topicContent.findUnique({
    where: { topicId_mode_locale: { topicId, mode, locale } },
  });
  const content =
    requested ??
    (locale === DEFAULT_LOCALE
      ? null
      : await prisma.topicContent.findUnique({
          where: {
            topicId_mode_locale: { topicId, mode, locale: DEFAULT_LOCALE },
          },
        }));

  // One lookup covering this topic and its two neighbours: the arrows name the
  // topic they lead to, so those titles need translating too, and a missing
  // row falls back to the base title rather than blanking the label.
  const neighbourIds = [topicId, prevTopic?.id, nextTopic?.id].filter(
    (id): id is string => id !== undefined
  );
  const translations =
    locale === DEFAULT_LOCALE
      ? []
      : await prisma.topicTranslation.findMany({
          where: { topicId: { in: neighbourIds }, locale },
        });
  const titleByTopic = new Map(translations.map((t) => [t.topicId, t.title]));
  const localisedTitle = (t: Topic) => titleByTopic.get(t.id) ?? t.title;
  const asLink = (t: Topic | null) => (t === null ? null : { id: t.id, title: localisedTitle(t) });

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
    topic: {
      id: topic.id,
      title: localisedTitle(topic),
      examDomain: topic.examDomain,
    },
    // Null at the two ends of the course, which is what hides the arrow.
    prev: asLink(prevTopic),
    next: asLink(nextTopic),
    mode,
    locale,
    // Which language the body actually is, which is not always the one asked
    // for. Distinct from `locale` on purpose.
    contentLocale: content?.locale ?? null,
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
