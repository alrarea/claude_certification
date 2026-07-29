import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useOnboardingGate } from "../lib/useOnboardingGate";
import { AuthLayout } from "../components/AuthLayout";
import { TextField } from "../components/TextField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { OnboardingModal } from "../components/OnboardingModal";

export function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showOnboarding, onboardingSubmitting, onboardingError, handleAuthResult, chooseNew, chooseAssess } =
    useOnboardingGate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (data.accessToken) {
        // OTP verification is currently disabled - registering logs you
        // straight in instead of sending you to /register/verify.
        login(data.accessToken, data.refreshToken);
        handleAuthResult(data);
        return;
      }
      const suffix = data.emailSent === false ? "&emailSent=0" : "";
      navigate(`/register/verify?email=${encodeURIComponent(email)}${suffix}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start prepping for CCAR-F / CCAR-P">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
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
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="text-sm text-center" style={{ marginTop: 20, color: "var(--color-ink-500)" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--color-clay)" }}>
          Log in
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
