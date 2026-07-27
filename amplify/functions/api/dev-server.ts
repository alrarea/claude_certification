import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./handler.ts";

const port = Number(process.env.PORT ?? 8787);
const origin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

// Local-only: production CORS is handled entirely by the Lambda Function
// URL's native config (see handler.ts's comment - Hono's own cors()
// middleware is deliberately NOT added there to avoid duplicate headers).
// This dev server runs as plain @hono/node-server with no such layer in
// front of it, so the browser blocks every cross-origin request from the
// Vite dev server without this. Wrapping `fetch` directly (rather than
// `app.use(cors())`) sidesteps a Hono middleware-ordering quirk where
// headers added via `use()` after the sub-routers were already mounted
// showed up on the OPTIONS preflight but not on the actual response.
async function fetchWithCors(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,HEAD,PUT,POST,DELETE,PATCH",
        "Access-Control-Allow-Headers": "content-type,authorization",
      },
    });
  }
  const response = await app.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  return new Response(response.body, { status: response.status, headers });
}

serve({ fetch: fetchWithCors, port }, (info) => {
  console.log(`API dev server listening on http://localhost:${info.port}`);
});
