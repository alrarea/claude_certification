import { z } from "zod";
import { passwordSchema } from "../password";

export const updateNameSchema = z.object({
  name: z.string().min(1).max(200),
});
export type UpdateNameInput = z.infer<typeof updateNameSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Cheap format pre-check before spending a live Anthropic API call to validate.
export const saveApiKeySchema = z.object({
  apiKey: z.string().regex(/^sk-ant-/, "Doesn't look like an Anthropic API key"),
});
export type SaveApiKeyInput = z.infer<typeof saveApiKeySchema>;
