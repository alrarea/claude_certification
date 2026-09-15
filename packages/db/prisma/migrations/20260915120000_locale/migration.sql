-- Adds the locale dimension so content can exist in more than one language.
--
-- Language is deliberately NOT a ContentMode value: mode is the pedagogical
-- shape of a topic, language is orthogonal, and UserTopicProgress.lastMode
-- would otherwise start conflating the two.

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('en', 'ml');

-- AlterTable: a constant DEFAULT backfills every existing row as part of the
-- same statement - Postgres records it as catalog metadata rather than
-- rewriting the table, so no separate UPDATE and no long lock.
ALTER TABLE "topic_content" ADD COLUMN "locale" "locale" NOT NULL DEFAULT 'en';

-- The init migration created this as a UNIQUE INDEX, not a table constraint,
-- so it is dropped with DROP INDEX. (DROP CONSTRAINT would error here.)
DROP INDEX "topic_content_topic_id_mode_key";
CREATE UNIQUE INDEX "topic_content_topic_id_mode_locale_key"
    ON "topic_content"("topic_id", "mode", "locale");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "locale" "locale" NOT NULL DEFAULT 'en';

-- CreateTable: translations live in their own rows rather than as title_ml
-- columns, so a third language is an INSERT rather than another migration,
-- and topics/certifications - read on every course-tree request - stay narrow.
CREATE TABLE "topic_translations" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "topic_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "certification_translations" (
    "id" UUID NOT NULL,
    "certification_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "certification_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_translations_topic_id_locale_key"
    ON "topic_translations"("topic_id", "locale");
CREATE UNIQUE INDEX "certification_translations_certification_id_locale_key"
    ON "certification_translations"("certification_id", "locale");

-- AddForeignKey
ALTER TABLE "topic_translations" ADD CONSTRAINT "topic_translations_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certification_translations" ADD CONSTRAINT "certification_translations_certification_id_fkey"
    FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
