import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@claude-cert/db";
import { requireAuth, requireAdmin, requireSuperAdmin, type AuthedVars } from "../lib/authMiddleware.ts";
import { decryptOtp } from "../lib/otp.ts";

export const adminRoutes = new Hono<{ Variables: AuthedVars }>();
adminRoutes.use("*", requireAuth, requireAdmin);

// Both admin and super_admin: list all users with a progress summary.
adminRoutes.get("/users", async (c) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { topicProgress: true } },
    },
  });

  const completedCounts = await prisma.userTopicProgress.groupBy({
    by: ["userId"],
    where: { status: "completed" },
    _count: { _all: true },
  });
  const completedByUser = new Map(completedCounts.map((r) => [r.userId, r._count._all]));

  return c.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: u.emailVerifiedAt !== null,
      createdAt: u.createdAt,
      topicsStarted: u._count.topicProgress,
      topicsCompleted: completedByUser.get(u.id) ?? 0,
    })),
  });
});

// Both admin and super_admin: detailed per-topic progress for one user.
adminRoutes.get("/users/:userId", async (c) => {
  const userId = c.req.param("userId");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true, createdAt: true },
  });
  if (!user) return c.json({ error: "User not found" }, 404);

  const progress = await prisma.userTopicProgress.findMany({
    where: { userId },
    include: { topic: { select: { title: true, examDomain: true, certification: { select: { code: true } } } } },
    orderBy: { lastViewedAt: "desc" },
  });

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt,
    },
    progress: progress.map((p) => ({
      topicTitle: p.topic.title,
      certification: p.topic.certification.code,
      examDomain: p.topic.examDomain,
      status: p.status,
      lastMode: p.lastMode,
      lastViewedAt: p.lastViewedAt,
    })),
  });
});

const setRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

// super_admin only: grant/revoke admin. Cannot grant super_admin through this
// endpoint - that stays a manual DB/seed action, same "no self-service" rule
// the spec applies to the original admin flag.
adminRoutes.post("/users/:userId/role", requireSuperAdmin, async (c) => {
  const userId = c.req.param("userId");
  const body = setRoleSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return c.json({ error: "User not found" }, 404);
  if (target.role === "super_admin") {
    return c.json({ error: "Cannot change a super_admin's role through this endpoint" }, 400);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: { role: body.data.role } });
  return c.json({ id: updated.id, role: updated.role });
});

// super_admin only: every currently-active OTP across all users, one row
// per email (a resend can leave several non-consumed rows for the same
// email - only the most recent counts as "active"). Used by the Users
// page's "Copy OTPs" button to bulk-read out codes to people who didn't
// get their email.
adminRoutes.get("/otps", requireSuperAdmin, async (c) => {
  const activeOtps = await prisma.otpCode.findMany({
    where: { consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  const latestByEmail = new Map<string, (typeof activeOtps)[number]>();
  for (const otp of activeOtps) {
    if (!latestByEmail.has(otp.email)) latestByEmail.set(otp.email, otp);
  }

  const emails = [...latestByEmail.keys()];
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, name: true } });
  const nameByEmail = new Map(users.map((u) => [u.email, u.name]));

  const otps = emails.map((email) => {
    const otp = latestByEmail.get(email)!;
    return {
      name: nameByEmail.get(email) ?? email,
      code: decryptOtp({ ciphertext: Buffer.from(otp.codeEnc), iv: Buffer.from(otp.codeIv) }),
    };
  });

  return c.json({ otps });
});

// super_admin only: view a user's current OTP (e.g. to read it out to someone
// who didn't receive the email). See schema.prisma's OtpCode comment for why
// this is encrypted (reversible) rather than hashed.
adminRoutes.get("/users/:userId/otp", requireSuperAdmin, async (c) => {
  const userId = c.req.param("userId");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return c.json({ error: "User not found" }, 404);

  const otp = await prisma.otpCode.findFirst({
    where: { email: user.email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return c.json({ error: "No active OTP for this user" }, 404);

  const code = decryptOtp({ ciphertext: Buffer.from(otp.codeEnc), iv: Buffer.from(otp.codeIv) });

  return c.json({
    code,
    purpose: otp.purpose,
    attempts: otp.attempts,
    expiresAt: otp.expiresAt,
    createdAt: otp.createdAt,
  });
});
