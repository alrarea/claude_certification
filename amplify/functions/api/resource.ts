import { defineFunction } from "@aws-amplify/backend";

export const apiFunction = defineFunction({
  name: "api",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  environment: {
    // Non-secret defaults; secrets (DB URL, JWT/enc/OTP secrets, SES sender)
    // are set via `ampx sandbox secret set` / Parameter Store, not here.
  },
});
