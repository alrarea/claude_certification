import Anthropic from "@anthropic-ai/sdk";

// Cheapest possible live call that proves the key actually works, before we
// persist it. A 1-token completion still counts as a real request against
// the key's own quota, so we don't run it more than once per save attempt.
export async function validateAnthropicKey(apiKey: string): Promise<boolean> {
  const client = new Anthropic({ apiKey });
  try {
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    return true;
  } catch {
    return false;
  }
}
