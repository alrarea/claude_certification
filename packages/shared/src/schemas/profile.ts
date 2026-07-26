import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "../constants";

export const updateNameSchema = z.object({
  name: z.string().min(1).max(200),
});
export type UpdateNameInput = z.infer<typeof updateNameSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Cheap format pre-check before spending a live Anthropic API call to validate.
export const saveApiKeySchema = z.object({
  apiKey: z.string().regex(/^sk-ant-/, "Doesn't look like an Anthropic API key"),
});
export type SaveApiKeyInput = z.infer<typeof saveApiKeySchema>;
