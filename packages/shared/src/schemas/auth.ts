import { z } from "zod";
import { ALLOWED_EMAIL_DOMAINS, OTP_LENGTH, PASSWORD_MIN_LENGTH } from "../constants";

const companyEmail = z
  .string()
  .email()
  .refine(
    (email) => ALLOWED_EMAIL_DOMAINS.some((domain) => email.toLowerCase().endsWith(`@${domain}`)),
    { message: `Email must be @${ALLOWED_EMAIL_DOMAINS.join(" or @")}` }
  );

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: companyEmail,
  password,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const registerVerifySchema = z.object({
  email: companyEmail,
  code: z.string().length(OTP_LENGTH).regex(/^\d+$/),
});
export type RegisterVerifyInput = z.infer<typeof registerVerifySchema>;

export const registerResendSchema = z.object({
  email: companyEmail,
});
export type RegisterResendInput = z.infer<typeof registerResendSchema>;

export const loginSchema = z.object({
  email: companyEmail,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
