-- CreateEnum
CREATE TYPE "role" AS ENUM ('user', 'admin', 'super_admin');

-- users: replace is_admin boolean with a 3-tier role enum
ALTER TABLE "users" ADD COLUMN "role" "role" NOT NULL DEFAULT 'user';
ALTER TABLE "users" DROP COLUMN "is_admin";

-- otp_codes: replace one-way hash with reversible AES-256-GCM encryption
-- (see schema.prisma's OtpCode comment for why)
ALTER TABLE "otp_codes" ADD COLUMN "code_enc" BYTEA;
ALTER TABLE "otp_codes" ADD COLUMN "code_iv" BYTEA;
ALTER TABLE "otp_codes" DROP COLUMN "code_hash";
ALTER TABLE "otp_codes" ALTER COLUMN "code_enc" SET NOT NULL;
ALTER TABLE "otp_codes" ALTER COLUMN "code_iv" SET NOT NULL;
