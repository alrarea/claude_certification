import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function encryptionKey(): Buffer {
  const value = process.env.APP_ENC_SECRET;
  if (!value) throw new Error("APP_ENC_SECRET is not set");
  // Expect a 32-byte key, base64-encoded, in the env var.
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("APP_ENC_SECRET must decode to exactly 32 bytes");
  return key;
}

export interface EncryptedValue {
  ciphertext: Buffer; // auth tag appended to the end
  iv: Buffer;
}

export function encrypt(plaintext: string): EncryptedValue {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([encrypted, authTag]), iv };
}

export function decrypt({ ciphertext, iv }: EncryptedValue): string {
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
