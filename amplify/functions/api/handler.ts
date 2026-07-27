import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { authRoutes } from "./routes/auth.ts";
import { profileRoutes } from "./routes/profile.ts";
import { courseRoutes } from "./routes/courses.ts";
import { adminRoutes } from "./routes/admin.ts";
import { examRoutes } from "./routes/exams.ts";
import { questionRoutes } from "./routes/questions.ts";
import { onboardingRoutes } from "./routes/onboarding.ts";
import { certificationRoutes } from "./routes/certifications.ts";

// CORS is handled entirely by the Lambda Function URL's own native CORS
// config (see backend.ts) - not duplicated here with Hono's cors()
// middleware. Both together produced two Access-Control-Allow-Origin values
// on the same response, which browsers reject outright (a header can only
// have one value) - this is exactly what caused every real cross-origin
// request from the deployed frontend to fail as a CORS error.
const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/profile", profileRoutes);
app.route("/courses", courseRoutes);
app.route("/admin", adminRoutes);
app.route("/exams", examRoutes);
app.route("/questions", questionRoutes);
app.route("/onboarding", onboardingRoutes);
app.route("/certifications", certificationRoutes);

export const handler = handle(app);
export default app;
