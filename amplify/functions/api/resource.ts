import { defineFunction, secret } from "@aws-amplify/backend";

export const apiFunction = defineFunction({
  name: "api",
  entry: "./handler.ts",
  // 60s, not 30s: a real (if since-resolved) DB latency spike was observed
  // taking ~28s against the old 30s timeout - too little headroom. Function
  // URLs support up to Lambda's own ceiling, so there's no platform reason
  // to keep this tight.
  timeoutSeconds: 60,
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
