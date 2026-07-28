import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useOnboardingGate } from "../lib/useOnboardingGate";
import { AuthLayout } from "../components/AuthLayout";
import { TextField } from "../components/TextField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { OnboardingModal } from "../components/OnboardingModal";

export function RegisterVerify() {
  const { login } = useAuth();
  const { showOnboarding, onboardingSubmitting, onboardingError, handleAuthResult, chooseNew, chooseAssess } =
    useOnboardingGate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [emailNotSent, setEmailNotSent] = useState(searchParams.get("emailSent") === "0");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      login(data.accessToken, data.refreshToken);
      handleAuthResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    setResent(false);
    try {
      const data = await apiFetch("/auth/register/resend", { method: "POST", body: JSON.stringify({ email }) });
      setResent(true);
      setEmailNotSent(data.emailSent === false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <AuthLayout title="Enter verification code" subtitle="We emailed you a 6-digit code">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          placeholder="you@alignminds.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Verification code"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          required
        />
        {error && <Alert kind="error">{error}</Alert>}
        {resent && !emailNotSent && <Alert kind="success">New code sent.</Alert>}
        {emailNotSent && (
          <Alert kind="error">
            We couldn't email you a code right now. Ask an admin for your verification code, then enter it above.
          </Alert>
        )}
        <Button type="submit" loading={submitting} block>
          Verify
        </Button>
        <Button type="button" variant="ghost" onClick={onResend}>
          Resend code
        </Button>
      </form>
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
