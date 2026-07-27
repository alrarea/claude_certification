/**
 * One-time ingestion: parses the delimited content files produced by the
 * content-generation pass (in scratch, not part of the repo) and upserts
 * mode='in_depth' / mode='concise' rows into topic_content. Idempotent.
 *
 * Usage: npx tsx scripts/ingest-content-variants.ts <file1> <file2> ...
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/client";

const TOPIC_RE = /@@@TOPIC id="([^"]+)"\s*##IN_DEPTH\s*([\s\S]*?)\s*##CONCISE\s*([\s\S]*?)\s*@@@END/g;

interface Parsed {
  topicId: string;
  inDepth: string;
  concise: string;
}

function parseFile(path: string): Parsed[] {
  const text = readFileSync(path, "utf8");
  const out: Parsed[] = [];
  let match: RegExpExecArray | null;
  TOPIC_RE.lastIndex = 0;
  while ((match = TOPIC_RE.exec(text)) !== null) {
    out.push({ topicId: match[1], inDepth: match[2].trim(), concise: match[3].trim() });
  }
  return out;
}

async function upsert(topicId: string, mode: "in_depth" | "concise", contentMd: string) {
  if (!contentMd.trim()) return;
  await prisma.topicContent.upsert({
    where: { topicId_mode: { topicId, mode } },
    update: { contentMd },
    create: { topicId, mode, contentMd },
  });
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npx tsx scripts/ingest-content-variants.ts <file1> <file2> ...");
    process.exitCode = 1;
    return;
  }

  let totalTopics = 0;
  for (const file of files) {
    const parsed = parseFile(file);
    console.log(`${file}: ${parsed.length} topics parsed`);
    for (const p of parsed) {
      const topic = await prisma.topic.findUnique({ where: { id: p.topicId } });
      if (!topic) {
        console.warn(`  ! topic ${p.topicId} not found, skipping`);
        continue;
      }
      await upsert(p.topicId, "in_depth", p.inDepth);
      await upsert(p.topicId, "concise", p.concise);
      totalTopics++;
    }
  }
  console.log(`Done. ${totalTopics} topics upserted (in_depth + concise).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
