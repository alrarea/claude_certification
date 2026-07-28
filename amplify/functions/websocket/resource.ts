import { defineFunction, secret } from "@aws-amplify/backend";

// Only $connect/$disconnect need DB access (record/remove the connection
// row) and JWT verification - clients never send messages over this socket,
// so there's nothing else this function needs. See functions/api/resource.ts
// for the same secret() pattern.
//
// timeoutSeconds: 29 (not a smaller number) - observed DB query latency in
// this environment can run ~27-28s (Prisma's WASM query engine appears to
// pay a real per-invocation cost here, not just on cold start - see the
// ~29s production login latency noted separately). API Gateway's WebSocket
// Lambda integration timeout caps out at 29s anyway, so this matches that
// ceiling rather than truncating the connection early.
export const websocketFunction = defineFunction({
  name: "websocket",
  entry: "./handler.ts",
  timeoutSeconds: 29,
  environment: {
    DATABASE_URL: secret("DATABASE_URL"),
    JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
  },
});
