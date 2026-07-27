import { Hono } from "hono";
import { prisma, type Prisma } from "@claude-cert/db";
import {
  registerSchema,
  registerVerifySchema,
  registerResendSchema,
  loginSchema,
  refreshSchema,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
} from "@claude-cert/shared";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { generateOtp, encryptOtp, verifyOtp } from "../lib/otp.ts";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.ts";
import { sendOtpEmail, EmailSendError } from "../lib/email.ts";
import { assertOtpSendAllowed, assertLoginAllowed, recordLoginAttempt, RateLimitError } from "../lib/rateLimit.ts";

export const authRoutes = new Hono();

async function issueOtp(email: string) {
  await assertOtpSendAllowed(email);

  const code = generateOtp();
  const { ciphertext, iv } = encryptOtp(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      email,
      codeEnc: new Uint8Array(ciphertext),
      codeIv: new Uint8Array(iv),
      purpose: "registration",
      expiresAt,
    },
  });

  await sendOtpEmail(email, code, OTP_EXPIRY_MINUTES);
}

authRoutes.post("/register", async (c) => {
  const body = registerSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { name, email, password } = body.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.emailVerifiedAt) {
    return c.json({ error: "account exists, log in instead" }, 409);
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { name, email, passwordHash },
  });

  try {
    await issueOtp(email);
  } catch (err) {
    if (err instanceof RateLimitError) return c.json({ error: err.message }, 429);
    if (err instanceof EmailSendError) return c.json({ error: err.message }, 502);
    throw err;
  }

  return c.json({ ok: true });
});

authRoutes.post("/register/resend", async (c) => {
  const body = registerResendSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  try {
    await issueOtp(body.data.email);
  } catch (err) {
    if (err instanceof RateLimitError) return c.json({ error: err.message }, 429);
    if (err instanceof EmailSendError) return c.json({ error: err.message }, 502);
    throw err;
  }

  return c.json({ ok: true });
});

authRoutes.post("/register/verify", async (c) => {
  const body = registerVerifySchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { email, code } = body.data;

  const otp = await prisma.otpCode.findFirst({
    where: { email, purpose: "registration", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return c.json({ error: "Code expired or not found. Request a new one." }, 400);
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return c.json({ error: "Too many incorrect attempts. Request a new code." }, 400);
  }

  if (!verifyOtp(code, { ciphertext: Buffer.from(otp.codeEnc), iv: Buffer.from(otp.codeIv) })) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return c.json({ error: "Incorrect code" }, 400);
  }

  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return tx.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  });

  const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = await signRefreshToken({ sub: user.id });

  return c.json({ accessToken, refreshToken });
});

authRoutes.post("/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { email, password } = body.data;

  try {
    await assertLoginAllowed(email);
  } catch (err) {
    if (err instanceof RateLimitError) return c.json({ error: err.message }, 429);
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    await recordLoginAttempt(email, false);
    return c.json({ error: "Incorrect email or password" }, 401);
  }

  if (!user.emailVerifiedAt) {
    await recordLoginAttempt(email, false);
    return c.json({ error: "Finish registration first — check your email for a verification code" }, 403);
  }

  await recordLoginAttempt(email, true);

  const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = await signRefreshToken({ sub: user.id });

  return c.json({
    accessToken,
    refreshToken,
    hasSeenOnboardingPrompt: user.onboardingPromptSeenAt !== null,
    lastCertificationCode: user.lastCertificationCode,
  });
});

authRoutes.post("/refresh", async (c) => {
  const body = refreshSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  let claims;
  try {
    claims = await verifyRefreshToken(body.data.refreshToken);
  } catch {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) return c.json({ error: "Invalid refresh token" }, 401);

  // Rotate on every use.
  const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = await signRefreshToken({ sub: user.id });

  return c.json({ accessToken, refreshToken });
});
