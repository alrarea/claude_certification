import "dotenv/config";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Reused across warm Lambda invocations; low connection_limit is set on
// DATABASE_URL itself (see .env.example) since the Lambda is not VPC-attached
// and can run many concurrent invocations against a single Postgres instance.
export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export * from "@prisma/client";
