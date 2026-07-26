import { prisma } from "@claude-cert/db";
import { OTP_MAX_SENDS_PER_HOUR, OTP_RESEND_COOLDOWN_SECONDS } from "@claude-cert/shared";

const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_FAILURES = 10;

export async function assertOtpSendAllowed(email: string): Promise<void> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recent = await prisma.otpCode.findMany({
    where: { email, purpose: "registration", createdAt: { gte: hourAgo } },
    orderBy: { createdAt: "desc" },
  });

  if (recent.length >= OTP_MAX_SENDS_PER_HOUR) {
    throw new RateLimitError("Too many verification codes requested. Try again later.");
  }

  const last = recent[0];
  if (last) {
    const secondsSinceLast = (now.getTime() - last.createdAt.getTime()) / 1000;
    if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
      throw new RateLimitError("Please wait before requesting another code.");
    }
  }
}

export async function assertLoginAllowed(email: string): Promise<void> {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
  const failures = await prisma.loginAttempt.count({
    where: { email, success: false, createdAt: { gte: windowStart } },
  });
  if (failures >= LOGIN_MAX_FAILURES) {
    throw new RateLimitError("Too many failed login attempts. Try again later.");
  }
}

export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, success } });
}

export class RateLimitError extends Error {}
