import { Hono } from "hono";
import { prisma } from "@claude-cert/db";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware.ts";

export const certificationRoutes = new Hono<{ Variables: AuthedVars }>();
certificationRoutes.use("*", requireAuth);

certificationRoutes.get("/", async (c) => {
  const certs = await prisma.certification.findMany({
    select: { code: true, name: true, description: true },
    orderBy: { code: "asc" },
  });
  return c.json({ certifications: certs });
});
