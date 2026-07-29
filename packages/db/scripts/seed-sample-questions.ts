/**
 * Seeds a handful of manually-authored sample questions so the exam engine
 * has something to serve out of the box. Real content growth is expected to
 * happen via the manual-authoring/upload/AI-generation routes (spec Section
 * 11) - this is just enough to exercise the exam flow end-to-end.
 */
import { prisma } from "../src/client";

async function main() {
  const cert = await prisma.certification.findUniqueOrThrow({ where: { code: "CCAR-F" } });
  const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: "tech@alignminds.com" } });
  const topic = await prisma.topic.findFirstOrThrow({
    where: { certificationId: cert.id, title: "The Agentic Loop — The Core of Everything" },
  });

  const questions = [
    {
      difficulty: "easy" as const,
      questionText: "What determines when Claude should stop the agentic loop?",
      options: [
        { optionText: "When stop_reason equals end_turn", isCorrect: true, explanation: "This is the only correct, designed stop condition." },
        { optionText: "When ten tool calls have been made", isCorrect: false, explanation: "Fixed iteration counts break on tasks needing more or fewer steps." },
        { optionText: "When the response text contains the word done", isCorrect: false, explanation: "Parsing text for completion words is unreliable, not the designed mechanism." },
        { optionText: "When the coordinator manually cancels the run", isCorrect: false, explanation: "Manual cancellation isn't the loop's normal termination signal." },
      ],
    },
    {
      difficulty: "medium" as const,
      questionText: "A coordinator spawns three subagents to research different topics in parallel. What must the coordinator do for each subagent's prompt?",
      options: [
        { optionText: "Include only the final research goal, letting the subagent infer everything else", isCorrect: false, explanation: "Subagents have no memory of the coordinator's context, so omitted details are simply unknown to them." },
        { optionText: "Include the research goal, quality criteria, and any source info the subagent needs", isCorrect: true, explanation: "Subagents only know what's explicitly included in their task prompt." },
        { optionText: "Include step-by-step instructions for exactly how to research", isCorrect: false, explanation: "Over-specifying steps removes the subagent's ability to decide how, which isn't required." },
        { optionText: "Include nothing, since subagents share the coordinator's context automatically", isCorrect: false, explanation: "Subagents do NOT automatically share the coordinator's context." },
      ],
    },
    {
      difficulty: "hard" as const,
      questionText: "An exam question states a financial refund must never exceed $500 without manager approval, with zero tolerance for exceptions. Which mechanism correctly enforces this?",
      options: [
        { optionText: "A prompt instruction telling Claude the refund limit", isCorrect: false, explanation: "Prompt instructions work most of the time but have a non-zero failure rate, unacceptable for a zero-exception rule." },
        { optionText: "A PreToolUse hook that blocks the refund tool call above $500 without approval", isCorrect: true, explanation: "Hooks run every time without fail, making them the only mechanism guaranteeing zero exceptions." },
        { optionText: "A system prompt reminder repeated at the start of every turn", isCorrect: false, explanation: "Still just a prompt instruction under the hood - not guaranteed." },
        { optionText: "Asking Claude to double-check its own refund amount before calling the tool", isCorrect: false, explanation: "Self-checking is still instruction-following, not a programmatic guarantee." },
      ],
    },
  ];

  for (const q of questions) {
    await prisma.question.create({
      data: {
        certificationId: cert.id,
        topicId: topic.id,
        difficulty: q.difficulty,
        questionText: q.questionText,
        source: "manual",
        createdBy: superAdmin.id,
        reviewStatus: "approved",
        options: {
          create: q.options.map((o, i) => ({
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            explanation: o.explanation,
            orderIndex: i,
          })),
        },
      },
    });
  }

  console.log(`Seeded ${questions.length} sample questions for topic "${topic.title}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
