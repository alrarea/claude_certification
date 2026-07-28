-- CreateEnum
CREATE TYPE "live_exam_phase" AS ENUM ('lobby', 'question', 'reveal', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "live_exams" (
    "id" UUID NOT NULL,
    "certification_id" UUID NOT NULL,
    "topic_scope" UUID,
    "difficulty" "exam_difficulty" NOT NULL,
    "requested_count" INTEGER NOT NULL,
    "answer_seconds" INTEGER NOT NULL,
    "reveal_seconds" INTEGER NOT NULL,
    "phase" "live_exam_phase" NOT NULL DEFAULT 'lobby',
    "current_index" INTEGER NOT NULL DEFAULT 0,
    "phase_started_at" TIMESTAMPTZ,
    "host_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "live_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_exam_questions" (
    "id" UUID NOT NULL,
    "live_exam_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "live_exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_exam_participants" (
    "id" UUID NOT NULL,
    "live_exam_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_exam_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_exam_answers" (
    "id" UUID NOT NULL,
    "live_exam_question_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "selected_option_id" UUID,
    "is_correct" BOOLEAN NOT NULL,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_exam_connections" (
    "id" UUID NOT NULL,
    "connection_id" TEXT NOT NULL,
    "live_exam_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_exam_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_exam_questions_live_exam_id_order_index_key" ON "live_exam_questions"("live_exam_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "live_exam_participants_live_exam_id_user_id_key" ON "live_exam_participants"("live_exam_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_exam_answers_live_exam_question_id_participant_id_key" ON "live_exam_answers"("live_exam_question_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_exam_connections_connection_id_key" ON "live_exam_connections"("connection_id");

-- AddForeignKey
ALTER TABLE "live_exams" ADD CONSTRAINT "live_exams_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exams" ADD CONSTRAINT "live_exams_topic_scope_fkey" FOREIGN KEY ("topic_scope") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exams" ADD CONSTRAINT "live_exams_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_questions" ADD CONSTRAINT "live_exam_questions_live_exam_id_fkey" FOREIGN KEY ("live_exam_id") REFERENCES "live_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_questions" ADD CONSTRAINT "live_exam_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_participants" ADD CONSTRAINT "live_exam_participants_live_exam_id_fkey" FOREIGN KEY ("live_exam_id") REFERENCES "live_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_participants" ADD CONSTRAINT "live_exam_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_answers" ADD CONSTRAINT "live_exam_answers_live_exam_question_id_fkey" FOREIGN KEY ("live_exam_question_id") REFERENCES "live_exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_answers" ADD CONSTRAINT "live_exam_answers_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "live_exam_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_answers" ADD CONSTRAINT "live_exam_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_exam_connections" ADD CONSTRAINT "live_exam_connections_live_exam_id_fkey" FOREIGN KEY ("live_exam_id") REFERENCES "live_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
