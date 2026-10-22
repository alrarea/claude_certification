import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./constants";

// One list drives both the server-side zod check and the live checklist the
// web app shows while the user types, so the two can never disagree.
export const PASSWORD_RULES = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "letter",
    label: "At least one letter",
    message: "Password must contain at least one letter",
    test: (value: string) => /[A-Za-z]/.test(value),
  },
  {
    id: "number",
    label: "At least one number",
    message: "Password must contain at least one number",
    test: (value: string) => /[0-9]/.test(value),
  },
] as const;

export const passwordSchema = PASSWORD_RULES.reduce(
  (schema, rule) => schema.refine(rule.test, rule.message),
  z.string() as z.ZodType<string>
);
