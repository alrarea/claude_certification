import { z } from "zod";

export const createExamSchema = z.object({
  certification: z.string().min(1), // certification code, e.g. "CCAF"
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
  questionCount: z.number().int().min(1).max(200),
  topicScope: z.string().uuid().optional(),
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

export const submitAnswerSchema = z.object({
  selectedOptionId: z.string().uuid(),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
