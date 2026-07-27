import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { TextField } from "../components/TextField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { OnboardingModal } from "../components/OnboardingModal";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState<"new" | "assess" | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [landingPath, setLandingPath] = useState("/learn");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(data.accessToken, data.refreshToken);
      const target = data.lastCertificationCode ? `/learn/${data.lastCertificationCode.toLowerCase()}` : "/learn";
      setLandingPath(target);
      if (data.hasSeenOnboardingPrompt) {
        navigate(target);
      } else {
        setShowOnboarding(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function chooseNew() {
    setOnboardingSubmitting("new");
    try {
      await apiFetch("/onboarding/choice", { method: "POST", body: JSON.stringify({ choice: "new" }) });
    } catch {
      // Best-effort - the popup is a one-time nicety, don't block on it.
    } finally {
      navigate(landingPath);
    }
  }

  async function chooseAssess() {
    setOnboardingSubmitting("assess");
    setOnboardingError(null);
    try {
      const data = await apiFetch("/onboarding/choice", { method: "POST", body: JSON.stringify({ choice: "assess" }) });
      navigate(`/exam/${data.examId}`);
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : "Couldn't start the assessment");
      setOnboardingSubmitting(null);
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back to Claude Certification Prep">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          placeholder="you@alignminds.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordField
          label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={submitting} block>
          {submitting ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <p className="text-sm text-center" style={{ marginTop: 20, color: "var(--color-ink-500)" }}>
        No account?{" "}
        <Link to="/register" style={{ color: "var(--color-clay)" }}>
          Register
        </Link>
      </p>
      {showOnboarding && (
        <OnboardingModal
          submitting={onboardingSubmitting}
          error={onboardingError}
          onNew={chooseNew}
          onAssess={chooseAssess}
        />
      )}
    </AuthLayout>
  );
}
