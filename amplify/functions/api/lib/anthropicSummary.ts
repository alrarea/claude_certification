import Anthropic from "@anthropic-ai/sdk";

export interface AssessmentAnswerItem {
  certification: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  chosenText: string;
  correctText: string;
  isCorrect: boolean;
}

export interface AssessmentSummary {
  summary: string;
  focusAreas: string[];
}

const SUMMARY_TOOL = {
  name: "return_summary",
  description: "Return the assessment performance summary.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "A 2-4 sentence narrative summary of the candidate's performance, encouraging but honest.",
      },
      focusAreas: {
        type: "array",
        items: { type: "string" },
        description: "Ranked list of topics/skills to focus study on next, most important first.",
      },
    },
    required: ["summary", "focusAreas"],
  },
};

function buildPrompt(params: { examLabel: string; items: AssessmentAnswerItem[] }): string {
  const qa = params.items
    .map((item, i) => {
      return `${i + 1}. [${item.certification} / ${item.difficulty}] Topic: ${item.topic}
Question: ${item.questionText}
Candidate answered: ${item.chosenText} (${item.isCorrect ? "correct" : "incorrect"})
${item.isCorrect ? "" : `Correct answer: ${item.correctText}`}`;
    })
    .join("\n\n");

  const certifications = new Set(params.items.map((i) => i.certification));
  const readinessInstruction =
    certifications.size > 1
      ? " Some of these questions are from a more advanced certification tier than others (see the bracketed tag on each question) - explicitly call out whether the candidate looks ready to move up to that tier based on how they did on those specific questions."
      : "";

  return `A candidate just took ${params.examLabel}. Here are their questions and answers:

${qa}

Write a short performance summary and a ranked list of topics they should focus on studying next, based on what they got wrong (and, if everything was correct, note their strengths and suggest what to explore next).${readinessInstruction}

Call the return_summary tool with the results.`;
}

export async function generateAssessmentSummary(params: {
  apiKey: string;
  examLabel: string;
  items: AssessmentAnswerItem[];
}): Promise<AssessmentSummary> {
  const client = new Anthropic({ apiKey: params.apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: "tool", name: "return_summary" },
    messages: [{ role: "user", content: buildPrompt(params) }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured summary data");
  }

  return toolUse.input as AssessmentSummary;
}
