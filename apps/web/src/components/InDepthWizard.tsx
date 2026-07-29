import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { Button } from "./Button";
import { MarkdownContent } from "./MarkdownContent";

interface WizardStep {
  title: string;
  body: string;
}

// In-depth content is stored as plain markdown - each "## Heading" starts a
// new wizard step (title = heading text, body = everything until the next
// "## "); anything before the first "##" becomes an unnumbered intro step.
// "###" and deeper stay inside a step as ordinary subheadings.
function parseSteps(markdown: string): WizardStep[] {
  const lines = markdown.split("\n");
  const steps: WizardStep[] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  function flush() {
    const bodyText = currentBody.join("\n").trim();
    if (currentTitle !== null || bodyText) {
      steps.push({ title: currentTitle ?? "Introduction", body: bodyText });
    }
  }

  for (const line of lines) {
    const headingMatch = /^##\s+(.*)$/.exec(line);
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return steps;
}

interface InDepthWizardProps {
  cert: string;
  topicId: string;
  topicTitle: string;
  // Called with `true` when the user reaches and clicks "Finish" (which has
  // already marked the topic complete server-side) - `false`/omitted when
  // closed early via the × button, so callers can update local UI state
  // (e.g. a "Mark as complete" button) without re-fetching.
  onClose: (completed?: boolean) => void;
}

export function InDepthWizard({ cert, topicId, topicTitle, onClose }: InDepthWizardProps) {
  const [steps, setSteps] = useState<WizardStep[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    apiFetch(`/courses/${cert}/topics/${topicId}?mode=in_depth`).then((data) => {
      setAvailable(data.available);
      setSteps(data.available ? parseSteps(data.contentMd ?? "") : []);
    });
  }, [cert, topicId]);

  async function handleNext() {
    if (steps && stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    setFinishing(true);
    try {
      await apiFetch(`/courses/${cert}/topics/${topicId}/progress`, { method: "POST" });
    } finally {
      setFinishing(false);
      onClose(true);
    }
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const isLastStep = steps ? stepIndex === steps.length - 1 : false;

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
      <div
        className="card"
        style={{ maxWidth: 720, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "20px 28px", borderBottom: "1px solid var(--color-border)" }}
        >
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>{topicTitle}</h2>
            {steps && steps.length > 0 && (
              <p className="text-xs" style={{ color: "var(--color-ink-500)", marginTop: 2 }}>
                Step {stepIndex + 1} of {steps.length}
                {steps[stepIndex]?.title ? ` — ${steps[stepIndex].title}` : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => onClose()}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-ink-500)" }}
          >
            ×
          </button>
        </div>

        {steps && steps.length > 0 && (
          <div style={{ padding: "4px 28px 0" }}>
            <div style={{ height: 4, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${((stepIndex + 1) / steps.length) * 100}%`,
                  height: "100%",
                  background: "var(--color-clay)",
                  transition: "width 0.15s ease",
                }}
              />
            </div>
          </div>
        )}

        <div style={{ padding: 28, overflowY: "auto", flex: 1 }}>
          {!steps ? (
            <p className="text-sm" style={{ color: "var(--color-ink-500)" }}>
              Loading...
            </p>
          ) : !available || steps.length === 0 ? (
            <p className="italic text-sm" style={{ color: "var(--color-ink-500)" }}>
              An in-depth walkthrough isn't available for this topic yet.
            </p>
          ) : (
            <div className="prose">
              <MarkdownContent>{steps[stepIndex].body}</MarkdownContent>
            </div>
          )}
        </div>

        {steps && steps.length > 0 && (
          <div
            className="flex items-center justify-between"
            style={{ padding: "16px 28px", borderTop: "1px solid var(--color-border)" }}
          >
            <Button variant="ghost" onClick={handleBack} disabled={stepIndex === 0}>
              Back
            </Button>
            <Button variant="clay" onClick={handleNext} loading={finishing}>
              {isLastStep ? "Finish" : "Next"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
