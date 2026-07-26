import { OPTION_LENGTH_IMBALANCE_THRESHOLD } from "@claude-cert/shared";

export interface OptionLike {
  optionText: string;
}

// Spec Section 10: options for a question must be of "roughly similar
// length" - flag if any option deviates more than ~40% from the average.
export function isOptionLengthBalanced(options: OptionLike[]): boolean {
  const lengths = options.map((o) => o.optionText.length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (avg === 0) return true;
  return lengths.every((len) => Math.abs(len - avg) / avg <= OPTION_LENGTH_IMBALANCE_THRESHOLD);
}
