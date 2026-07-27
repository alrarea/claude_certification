import { Button } from "./Button";
import { Alert } from "./Alert";

interface OnboardingModalProps {
  submitting: "new" | "assess" | null;
  error: string | null;
  onNew: () => void;
  onAssess: () => void;
}

export function OnboardingModal({ submitting, error, onNew, onAssess }: OnboardingModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 20, 19, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div className="card" style={{ maxWidth: 440, width: "100%", padding: 32 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, marginBottom: 8 }}>Welcome!</h2>
        <p className="text-sm" style={{ color: "var(--color-ink-500)", marginBottom: 24 }}>
          Are you new to Claude Certification prep, or would you like a quick assessment of where you stand today?
        </p>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Button variant="clay" block loading={submitting === "assess"} disabled={!!submitting} onClick={onAssess}>
            Assess me (up to 15 quick questions)
          </Button>
          <Button variant="secondary" block loading={submitting === "new"} disabled={!!submitting} onClick={onNew}>
            I'm new — skip to Learn
          </Button>
        </div>
      </div>
    </div>
  );
}
