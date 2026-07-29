import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";

interface Results {
  scorePct: number;
  isAssessment: boolean;
  byTopic: { topicId: string; title: string; certCode: string; correct: number; total: number }[];
  byDifficulty: { difficulty: string; correct: number; total: number }[];
  byCertification: { code: string; name: string; correct: number; total: number }[];
  missed: {
    questionId: string;
    questionText: string;
    topicId: string;
    topicTitle: string;
    certCode: string;
    selectedOptionId: string | null;
    options: { id: string; optionText: string; isCorrect: boolean; explanation: string }[];
  }[];
}

interface AiSummary {
  summary: string;
  focusAreas: string[];
}

function readinessVerdict(cert: { correct: number; total: number }): string | null {
  if (cert.total === 0) return null;
  const pct = cert.correct / cert.total;
  if (pct >= 0.7) return "You're already performing at a Professional (CCAR-P) level on these questions.";
  if (pct >= 0.4) return "You have a foundation for Professional-tier material, but some gaps remain.";
  return "Focus on Foundations (CCAR-F) topics before tackling Professional (CCAR-P) material.";
}

export function ExamResults() {
  const { id = "" } = useParams();
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/exams/${id}/results`)
      .then(setResults)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load results"));
    apiFetch("/profile")
      .then((p) => setHasAnthropicKey(!!p.hasAnthropicKey))
      .catch(() => {});
  }, [id]);

  async function generateAiSummary() {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await apiFetch(`/exams/${id}/ai-summary`, { method: "POST" });
      setAiSummary(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setAiLoading(false);
    }
  }

  if (error) {
    return (
      <AppShell maxWidth={700}>
        <Alert kind="error">{error}</Alert>
      </AppShell>
    );
  }
  if (!results) {
    return (
      <AppShell maxWidth={700}>
        <FullPageLoader label="Scoring exam..." />
      </AppShell>
    );
  }

  const weakTopics = results.byTopic
    .filter((t) => t.correct < t.total)
    .sort((a, b) => a.correct / a.total - b.correct / b.total);
  const ccapEntry = results.byCertification.find((c) => c.code === "CCAR-P");
  const readiness = ccapEntry ? readinessVerdict(ccapEntry) : null;

  return (
    <AppShell maxWidth={700}>
      <Link
        to="/exam/new"
        className="text-sm"
        style={{ color: "var(--color-ink-500)", display: "inline-block", marginBottom: 12 }}
      >
        ← Back to exams
      </Link>
      <div className="card flex flex-col items-center" style={{ padding: "32px 24px", marginBottom: 28 }}>
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
          Your score
        </span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--color-clay)" }}>
          {results.scorePct.toFixed(0)}%
        </span>
      </div>

      {results.isAssessment && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, marginBottom: 12 }}>Focus areas</h2>
          {weakTopics.length === 0 ? (
            <p className="text-sm">Strong across the board on this assessment — nice work.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {weakTopics.map((t) => (
                <li key={t.topicId} className="flex items-center justify-between">
                  <Link to={`/learn/${t.certCode}/${t.topicId}`} style={{ color: "var(--color-clay)" }}>
                    {t.title}
                  </Link>
                  <span style={{ color: "var(--color-ink-500)" }}>
                    {t.correct}/{t.total}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {readiness && (
            <p className="text-sm" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
              {readiness}
              <span style={{ color: "var(--color-ink-500)" }}>
                {" "}
                (Professional-tier score: {ccapEntry!.correct}/{ccapEntry!.total})
              </span>
            </p>
          )}

          {aiSummary ? (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--color-border)" }}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>AI-generated summary</h3>
              <p className="text-sm" style={{ marginBottom: 12 }}>
                {aiSummary.summary}
              </p>
              <ul className="text-sm flex flex-col gap-1">
                {aiSummary.focusAreas.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          ) : hasAnthropicKey ? (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--color-border)" }}>
              {aiError && (
                <div style={{ marginBottom: 12 }}>
                  <Alert kind="error">{aiError}</Alert>
                </div>
              )}
              <Button variant="secondary" size="sm" loading={aiLoading} onClick={generateAiSummary}>
                Get an AI-generated summary
              </Button>
            </div>
          ) : (
            <p className="text-xs" style={{ marginTop: 16, color: "var(--color-ink-500)" }}>
              Add an{" "}
              <Link to="/profile" style={{ color: "var(--color-clay)" }}>
                Anthropic API key
              </Link>{" "}
              in your profile for a personalized AI summary.
            </p>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, marginBottom: 12 }}>By topic</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {results.byTopic.map((t) => (
            <li key={t.topicId} className="flex items-center justify-between">
              <span>{t.title}</span>
              <span style={{ color: "var(--color-ink-500)" }}>
                {t.correct}/{t.total}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, marginBottom: 12 }}>By difficulty</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {results.byDifficulty.map((d) => (
            <li key={d.difficulty} className="flex items-center justify-between">
              <span style={{ textTransform: "capitalize" }}>{d.difficulty}</span>
              <span style={{ color: "var(--color-ink-500)" }}>
                {d.correct}/{d.total}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {results.missed.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 17, marginBottom: 12 }}>Missed questions</h2>
          <ul className="flex flex-col gap-5 text-sm">
            {results.missed.map((m) => (
              <li key={m.questionId} style={{ paddingBottom: 20, borderBottom: "1px solid var(--color-border)" }}>
                <p style={{ marginBottom: 10, fontWeight: 500 }}>{m.questionText}</p>
                <ul className="flex flex-col gap-2" style={{ marginBottom: 10 }}>
                  {m.options.map((o) => {
                    const wasSelected = o.id === m.selectedOptionId;
                    return (
                      <li
                        key={o.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--color-border)",
                          borderColor: o.isCorrect
                            ? "var(--color-success, #2f6f4f)"
                            : wasSelected
                              ? "var(--color-error, #b3432b)"
                              : "var(--color-border)",
                          background: o.isCorrect ? "var(--color-success-bg)" : "#fff",
                        }}
                      >
                        <p style={{ marginBottom: 4 }}>
                          {o.optionText}
                          {o.isCorrect && (
                            <span style={{ color: "var(--color-success, #2f6f4f)" }}> — correct answer</span>
                          )}
                          {wasSelected && !o.isCorrect && (
                            <span style={{ color: "var(--color-error, #b3432b)" }}> — your answer</span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-ink-500)" }}>
                          {o.explanation}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <Link to={`/learn/${m.certCode}/${m.topicId}`} style={{ color: "var(--color-clay)" }}>
                  Review {m.topicTitle} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
