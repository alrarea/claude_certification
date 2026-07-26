import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "./jwt";

export interface AuthedVars {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

export const requireAuth: MiddlewareHandler<{ Variables: AuthedVars }> = async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const claims = await verifyAccessToken(token);
    c.set("userId", claims.sub);
    c.set("userEmail", claims.email);
    c.set("isAdmin", claims.isAdmin);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};

export const requireAdmin: MiddlewareHandler<{ Variables: AuthedVars }> = async (c, next) => {
  if (!c.get("isAdmin")) return c.json({ error: "Forbidden" }, 403);
  await next();
};
