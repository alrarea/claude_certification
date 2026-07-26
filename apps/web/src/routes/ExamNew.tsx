import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { SelectField } from "../components/TextField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

const PRESETS = [10, 20, 40, 60];

export function ExamNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lockedTopic = searchParams.get("topic");
  const lockedCert = searchParams.get("cert");

  const [certification, setCertification] = useState(lockedCert ?? "ccaf");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [feedbackMode, setFeedbackMode] = useState<"immediate" | "end_of_set">("immediate");
  const [questionCount, setQuestionCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch("/exams", {
        method: "POST",
        body: JSON.stringify({
          certification,
          difficulty,
          feedbackMode,
          questionCount,
          ...(lockedTopic ? { topicScope: lockedTopic } : {}),
        }),
      });
      navigate(`/exam/${data.examId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start exam");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell maxWidth={520}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>New exam</h1>
      <form onSubmit={onSubmit} className="card flex flex-col gap-4" style={{ padding: 28 }}>
        {!lockedCert && (
          <SelectField label="Certification" value={certification} onChange={(e) => setCertification(e.target.value)}>
            <option value="ccaf">CCAF</option>
            <option value="ccap">CCAP</option>
          </SelectField>
        )}
        <SelectField label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
          <option value="mixed">Mixed</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </SelectField>
        <SelectField
          label="Feedback"
          value={feedbackMode}
          onChange={(e) => setFeedbackMode(e.target.value as typeof feedbackMode)}
        >
          <option value="immediate">Immediate feedback</option>
          <option value="end_of_set">Feedback at the end</option>
        </SelectField>
        <div className="field">
          <label className="field-label">Number of questions</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESETS.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setQuestionCount(n)}
                className={`chip ${questionCount === n ? "active" : ""}`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              className="input"
              style={{ width: 84 }}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              min={1}
            />
          </div>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={submitting} variant="clay" block>
          Start exam
        </Button>
      </form>
    </AppShell>
  );
}
