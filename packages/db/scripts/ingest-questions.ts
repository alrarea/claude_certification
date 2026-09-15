/**
 * One-time ingestion: parses the delimited question files produced by the
 * question-bank generation pass (in scratch, not part of the repo) and
 * creates Question + QuestionOption rows. Idempotent-ish: skips a topic if
 * it already has questions at the same difficulty count we're about to add
 * is NOT checked - re-running will duplicate, so only run once per file.
 *
 * Usage: npx tsx scripts/ingest-questions.ts <file1> <file2> ...
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/client";

const QUESTION_RE =
  /@@@QUESTION topicId="([^"]+)" difficulty="(easy|medium|hard)"\s*TEXT:\s*([\s\S]*?)\s*A_CORRECT:\s*(true|false)\s*A_TEXT:\s*([\s\S]*?)\s*A_EXPLANATION:\s*([\s\S]*?)\s*B_CORRECT:\s*(true|false)\s*B_TEXT:\s*([\s\S]*?)\s*B_EXPLANATION:\s*([\s\S]*?)\s*C_CORRECT:\s*(true|false)\s*C_TEXT:\s*([\s\S]*?)\s*C_EXPLANATION:\s*([\s\S]*?)\s*D_CORRECT:\s*(true|false)\s*D_TEXT:\s*([\s\S]*?)\s*D_EXPLANATION:\s*([\s\S]*?)\s*@@@END/g;

interface ParsedQuestion {
  topicId: string;
  difficulty: "easy" | "medium" | "hard";
  text: string;
  options: { text: string; isCorrect: boolean; explanation: string }[];
}

function parseFile(path: string): ParsedQuestion[] {
  const raw = readFileSync(path, "utf8");
  const out: ParsedQuestion[] = [];
  let m: RegExpExecArray | null;
  QUESTION_RE.lastIndex = 0;
  while ((m = QUESTION_RE.exec(raw)) !== null) {
    out.push({
      topicId: m[1],
      difficulty: m[2] as "easy" | "medium" | "hard",
      text: m[3].trim(),
      options: [
        { isCorrect: m[4] === "true", text: m[5].trim(), explanation: m[6].trim() },
        { isCorrect: m[7] === "true", text: m[8].trim(), explanation: m[9].trim() },
        { isCorrect: m[10] === "true", text: m[11].trim(), explanation: m[12].trim() },
        { isCorrect: m[13] === "true", text: m[14].trim(), explanation: m[15].trim() },
      ],
    });
  }
  return out;
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npx tsx scripts/ingest-questions.ts <file1> <file2> ...");
    process.exitCode = 1;
    return;
  }

  const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: "tech@alignminds.com" } });
  const topicCache = new Map<string, { certificationId: string } | null>();

  let created = 0;
  let skipped = 0;
  for (const file of files) {
    const parsed = parseFile(file);
    console.log(`${file}: ${parsed.length} questions parsed`);
    for (const q of parsed) {
      if (q.options.length !== 4 || q.options.filter((o) => o.isCorrect).length !== 1) {
        console.warn(`  ! skipping malformed question for topic ${q.topicId} (bad option shape)`);
        skipped++;
        continue;
      }
      if (!topicCache.has(q.topicId)) {
        const topic = await prisma.topic.findUnique({ where: { id: q.topicId } });
        topicCache.set(q.topicId, topic ? { certificationId: topic.certificationId } : null);
      }
      const topic = topicCache.get(q.topicId);
      if (!topic) {
        console.warn(`  ! topic ${q.topicId} not found, skipping`);
        skipped++;
        continue;
      }

      await prisma.question.create({
        data: {
          certificationId: topic.certificationId,
          topicId: q.topicId,
          difficulty: q.difficulty,
          questionText: q.text,
          source: "ai_generated",
          createdBy: superAdmin.id,
          reviewStatus: "approved",
          options: {
            create: q.options.map((o, i) => ({
              optionText: o.text,
              isCorrect: o.isCorrect,
              explanation: o.explanation,
              orderIndex: i,
            })),
          },
        },
      });
      created++;
    }
  }
  console.log(`Done. ${created} questions created, ${skipped} skipped.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
