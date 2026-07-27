import Anthropic from "@anthropic-ai/sdk";
import { isOptionLengthBalanced } from "./optionBalance.ts";

export interface GeneratedOption {
  optionText: string;
  isCorrect: boolean;
  explanation: string;
}

export interface GeneratedQuestion {
  questionText: string;
  difficulty: "easy" | "medium" | "hard";
  topicId: string;
  options: GeneratedOption[];
}

const QUESTIONS_TOOL = {
  name: "return_questions",
  description: "Return the generated exam questions.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionText: { type: "string" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            topicId: { type: "string", description: "Best-matching topic id from the provided list" },
            options: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  optionText: { type: "string" },
                  isCorrect: { type: "boolean" },
                  explanation: { type: "string", description: "Why this option is right or wrong" },
                },
                required: ["optionText", "isCorrect", "explanation"],
              },
            },
          },
          required: ["questionText", "difficulty", "topicId", "options"],
        },
      },
    },
    required: ["questions"],
  },
};

function buildPrompt(params: {
  certificationName: string;
  topics: { id: string; title: string }[];
  difficulty: "easy" | "medium" | "hard" | "mixed";
  count: number;
  sourceContent?: string;
}): string {
  const topicList = params.topics.map((t) => `- ${t.id}: ${t.title}`).join("\n");
  const difficultyInstruction =
    params.difficulty === "mixed"
      ? "Mix of easy, medium, and hard questions, weighted toward the harder end of the exam - roughly 50% hard, 30% medium, 20% easy."
      : `All questions should be "${params.difficulty}" difficulty.`;

  const sourceInstruction = params.sourceContent
    ? `Base the questions on this source material:\n\n${params.sourceContent}\n\n`
    : "";

  return `Generate ${params.count} multiple-choice exam questions for the "${params.certificationName}" certification.

${sourceInstruction}Each question must have exactly 4 answer options: exactly one correct, three incorrect. Every option (correct and incorrect) needs its own explanation of why it is right or wrong. All 4 options for a given question must be of roughly similar length (within ~40% of each other) - do not make the correct answer noticeably longer or more detailed than the distractors.

${difficultyInstruction}

Pick the best-matching topic id for each question from this list:
${topicList}

Call the return_questions tool with the results.`;
}

async function callModel(apiKey: string, prompt: string): Promise<GeneratedQuestion[]> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    tools: [QUESTIONS_TOOL],
    tool_choice: { type: "tool", name: "return_questions" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured question data");
  }

  const input = toolUse.input as { questions: GeneratedQuestion[] };
  return input.questions;
}

export async function generateQuestions(params: {
  apiKey: string;
  certificationName: string;
  topics: { id: string; title: string }[];
  difficulty: "easy" | "medium" | "hard" | "mixed";
  count: number;
  sourceContent?: string;
}): Promise<GeneratedQuestion[]> {
  const prompt = buildPrompt(params);
  let questions = await callModel(params.apiKey, prompt);

  // One-shot rewrite pass for any question whose options fail the
  // length-balance check (spec Section 10).
  const unbalanced = questions.filter((q) => !isOptionLengthBalanced(q.options));
  if (unbalanced.length > 0) {
    const rewritePrompt = `Rewrite these questions so all 4 options are of roughly similar length (within ~40% of each other), keeping the same correct answer and meaning:\n\n${JSON.stringify(
      unbalanced
    )}\n\nCall the return_questions tool with the corrected versions, in the same order.`;
    const rewritten = await callModel(params.apiKey, rewritePrompt);
    const rewrittenByText = new Map(rewritten.map((q) => [q.questionText, q]));
    questions = questions.map((q) => {
      if (!isOptionLengthBalanced(q.options)) {
        return rewrittenByText.get(q.questionText) ?? q;
      }
      return q;
    });
  }

  return questions;
}
