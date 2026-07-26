import { Hono } from "hono";
import { prisma } from "@claude-cert/db";
import { updateNameSchema, changePasswordSchema, saveApiKeySchema } from "@claude-cert/shared";
import { hashPassword, verifyPassword } from "../lib/password";
import { encrypt } from "../lib/crypto";
import { validateAnthropicKey } from "../lib/anthropicKeyValidate";
import { requireAuth, type AuthedVars } from "../lib/authMiddleware";

export const profileRoutes = new Hono<{ Variables: AuthedVars }>();
profileRoutes.use("*", requireAuth);

function toProfileView(user: {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  anthropicKeyLast4: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    hasAnthropicKey: user.anthropicKeyLast4 !== null,
    anthropicKeyLast4: user.anthropicKeyLast4,
  };
}

profileRoutes.get("/", async (c) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: c.get("userId") } });
  return c.json(toProfileView(user));
});

profileRoutes.patch("/", async (c) => {
  const body = updateNameSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const user = await prisma.user.update({
    where: { id: c.get("userId") },
    data: { name: body.data.name },
  });
  return c.json(toProfileView(user));
});

profileRoutes.post("/password", async (c) => {
  const body = changePasswordSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: c.get("userId") } });
  if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
    return c.json({ error: "Current password is incorrect" }, 400);
  }

  const passwordHash = await hashPassword(body.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return c.json({ ok: true });
});

profileRoutes.post("/api-key", async (c) => {
  const body = saveApiKeySchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const valid = await validateAnthropicKey(body.data.apiKey);
  if (!valid) {
    return c.json({ error: "That key didn't work against the Anthropic API — check it and try again." }, 400);
  }

  const { ciphertext, iv } = encrypt(body.data.apiKey);
  const last4 = body.data.apiKey.slice(-4);

  await prisma.user.update({
    where: { id: c.get("userId") },
    data: {
      anthropicApiKeyEnc: new Uint8Array(ciphertext),
      anthropicApiKeyIv: new Uint8Array(iv),
      anthropicKeyLast4: last4,
    },
  });

  return c.json({ ok: true, anthropicKeyLast4: last4 });
});

profileRoutes.delete("/api-key", async (c) => {
  await prisma.user.update({
    where: { id: c.get("userId") },
    data: { anthropicApiKeyEnc: null, anthropicApiKeyIv: null, anthropicKeyLast4: null },
  });
  return c.json({ ok: true });
});
