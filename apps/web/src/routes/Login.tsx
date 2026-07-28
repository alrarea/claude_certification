import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useOnboardingGate } from "../lib/useOnboardingGate";
import { AuthLayout } from "../components/AuthLayout";
import { TextField } from "../components/TextField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { OnboardingModal } from "../components/OnboardingModal";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showOnboarding, onboardingSubmitting, onboardingError, handleAuthResult, chooseNew, chooseAssess } =
    useOnboardingGate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      handleAuthResult(data);
    } catch (err) {
      if (err instanceof ApiError && err.data?.needsVerification) {
        const emailSent = err.data?.emailSent;
        const suffix = emailSent === false ? "&emailSent=0" : "";
        navigate(`/register/verify?email=${encodeURIComponent(email)}${suffix}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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
