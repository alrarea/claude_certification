import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

// argon2id via hash-wasm (pure WebAssembly) rather than @node-rs/argon2 (native
// binary) - the native package's platform-specific binary is selected at
// `npm install` time on the *developer's* OS, not the Lambda's, so it silently
// bundled the Windows binary into a Linux Lambda and crashed at runtime
// ("Failed to load native binding"). WASM has no such platform split.
const SALT_LENGTH = 16;
const PARALLELISM = 1;
const ITERATIONS = 256;
const MEMORY_SIZE_KB = 19456; // ~19 MB, OWASP-recommended minimum for argon2id
const HASH_LENGTH = 32;

export async function hashPassword(plain: string): Promise<string> {
  return argon2id({
    password: plain,
    salt: randomBytes(SALT_LENGTH),
    parallelism: PARALLELISM,
    iterations: ITERATIONS,
    memorySize: MEMORY_SIZE_KB,
    hashLength: HASH_LENGTH,
    outputType: "encoded",
  });
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  return argon2Verify({ password: plain, hash: hashed });
}
