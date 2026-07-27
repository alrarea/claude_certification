ALTER TABLE "users" ADD COLUMN "onboarding_prompt_seen_at" TIMESTAMPTZ;
ALTER TABLE "exams" ADD COLUMN "is_assessment" BOOLEAN NOT NULL DEFAULT false;
