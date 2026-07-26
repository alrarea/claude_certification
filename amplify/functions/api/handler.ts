import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/aws-lambda";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profile";
import { courseRoutes } from "./routes/courses";
import { adminRoutes } from "./routes/admin";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = process.env.FRONTEND_ORIGIN;
      return origin === allowed ? origin : undefined;
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/profile", profileRoutes);
app.route("/courses", courseRoutes);
app.route("/admin", adminRoutes);

export const handler = handle(app);
export default app;
