import { defineFunction, secret } from "@aws-amplify/backend";

export const apiFunction = defineFunction({
  name: "api",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  environment: {
    // secret() resolves to SSM Parameter Store (Standard tier) - set via
    // `ampx sandbox secret set <name>`, never committed. FRONTEND_ORIGIN is
    // not a secret; it's set directly on the Lambda in backend.ts once the
    // frontend's real URL is known.
    DATABASE_URL: secret("DATABASE_URL"),
    JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
    APP_ENC_SECRET: secret("APP_ENC_SECRET"),
    SES_FROM_ADDRESS: secret("SES_FROM_ADDRESS"),
  },
});
