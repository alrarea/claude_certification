import { z } from "zod";
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES } from "../constants";

const optionInputSchema = z.object({
  optionText: z.string().min(1),
  isCorrect: z.boolean(),
  explanation: z.string().min(1),
});

export const createQuestionSchema = z.object({
  certification: z.string().min(1),
  topicId: z.string().uuid(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionText: z.string().min(1),
  options: z.array(optionInputSchema).length(4),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const generateQuestionsSchema = z.object({
  certification: z.string().min(1),
  topicId: z.string().uuid().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
  count: z.number().int().min(1).max(20),
});
export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;

export const reviewQuestionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});
export type ReviewQuestionInput = z.infer<typeof reviewQuestionSchema>;

export const uploadDocumentSchema = z.object({
  certification: z.string().min(1),
  filename: z
    .string()
    .min(1)
    .refine(
      (name) => ALLOWED_UPLOAD_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
      `File must be one of: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`
    ),
  contentBase64: z.string().min(1).refine((b64) => {
    // Rough decoded-size check without actually decoding (base64 is ~4/3 the size).
    return (b64.length * 3) / 4 <= MAX_UPLOAD_SIZE_BYTES;
  }, `File must be under ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB`),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
