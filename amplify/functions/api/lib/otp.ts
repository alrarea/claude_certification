import { randomInt } from "node:crypto";
import { OTP_LENGTH } from "@claude-cert/shared";
import { encrypt, decrypt, type EncryptedValue } from "./crypto";

export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

export function encryptOtp(code: string): EncryptedValue {
  return encrypt(code);
}

export function decryptOtp(value: EncryptedValue): string {
  return decrypt(value);
}

export function verifyOtp(code: string, stored: EncryptedValue): boolean {
  return decryptOtp(stored) === code;
}
