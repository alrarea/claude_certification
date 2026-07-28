import { z } from "zod";

export const createLiveExamSchema = z.object({
  certification: z.string().min(1), // certification code, e.g. "CCAF"
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
  questionCount: z.number().int().min(1).max(100),
  answerSeconds: z.number().int().min(5).max(600),
  revealSeconds: z.number().int().min(3).max(600),
  topicScope: z.string().uuid().optional(),
});
export type CreateLiveExamInput = z.infer<typeof createLiveExamSchema>;

export const liveExamSubmitAnswerSchema = z.object({
  selectedOptionId: z.string().uuid(),
});
export type LiveExamSubmitAnswerInput = z.infer<typeof liveExamSubmitAnswerSchema>;
