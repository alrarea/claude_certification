import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

interface AuthResult {
  hasSeenOnboardingPrompt?: boolean;
  lastCertificationCode?: string | null;
}

// Shared by every page that can be someone's *first* successful auth this
// session (Login.tsx and RegisterVerify.tsx both land here - a user can hit
// either one first depending on whether their initial login found them
// unverified and bounced them into verification) - keeping this logic in
// one place is what stops the popup from silently working on one entry
// point and not the other.
export function useOnboardingGate() {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState<"new" | "assess" | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [landingPath, setLandingPath] = useState("/learn");

  function handleAuthResult(data: AuthResult) {
    const target = data.lastCertificationCode ? `/learn/${data.lastCertificationCode.toLowerCase()}` : "/learn";
    setLandingPath(target);
    if (data.hasSeenOnboardingPrompt) {
      navigate(target);
    } else {
      setShowOnboarding(true);
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

  return { showOnboarding, onboardingSubmitting, onboardingError, handleAuthResult, chooseNew, chooseAssess };
}
