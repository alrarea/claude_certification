import type { MiddlewareHandler } from "hono";
import { verifyAccessToken, type UserRole } from "./jwt";

export interface AuthedVars {
  userId: string;
  userEmail: string;
  userRole: UserRole;
}

export const requireAuth: MiddlewareHandler<{ Variables: AuthedVars }> = async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const claims = await verifyAccessToken(token);
    c.set("userId", claims.sub);
    c.set("userEmail", claims.email);
    c.set("userRole", claims.role);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};

// admin and super_admin both qualify — admin capabilities are a subset of
// what super_admin can do.
export const requireAdmin: MiddlewareHandler<{ Variables: AuthedVars }> = async (c, next) => {
  const role = c.get("userRole");
  if (role !== "admin" && role !== "super_admin") return c.json({ error: "Forbidden" }, 403);
  await next();
};

export const requireSuperAdmin: MiddlewareHandler<{ Variables: AuthedVars }> = async (c, next) => {
  if (c.get("userRole") !== "super_admin") return c.json({ error: "Forbidden" }, 403);
  await next();
};
