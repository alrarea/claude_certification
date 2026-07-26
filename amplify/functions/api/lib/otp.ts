import { createHmac, randomInt } from "node:crypto";
import { OTP_LENGTH } from "@claude-cert/shared";

function pepper(): string {
  const value = process.env.OTP_HASH_PEPPER;
  if (!value) throw new Error("OTP_HASH_PEPPER is not set");
  return value;
}

export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

export function hashOtp(code: string, email: string): string {
  // Keyed on email too, so the same code sent to two addresses hashes differently.
  return createHmac("sha256", pepper()).update(`${email.toLowerCase()}:${code}`).digest("hex");
}

export function verifyOtp(code: string, email: string, storedHash: string): boolean {
  return hashOtp(code, email) === storedHash;
}
