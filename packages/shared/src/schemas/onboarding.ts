import { z } from "zod";

export const onboardingChoiceSchema = z.object({
  choice: z.enum(["new", "assess"]),
});
export type OnboardingChoiceInput = z.infer<typeof onboardingChoiceSchema>;
