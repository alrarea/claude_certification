import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { SelectField } from "../components/TextField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

const QUESTION_PRESETS = [5, 10, 15, 20];

export function LiveExamCreate() {
  const navigate = useNavigate();

  const [certification, setCertification] = useState("ccar-f");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [answerSeconds, setAnswerSeconds] = useState(30);
  const [revealSeconds, setRevealSeconds] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch("/live-exams", {
        method: "POST",
        body: JSON.stringify({ certification, difficulty, questionCount, answerSeconds, revealSeconds }),
      });
      navigate(`/live-exam/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create live exam");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell maxWidth={520}>
      <Link
        to="/exam/new"
        className="text-sm"
        style={{ color: "var(--color-ink-500)", display: "inline-block", marginBottom: 12 }}
      >
        ← Back to exams
      </Link>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Host a live exam</h1>
      <form onSubmit={onSubmit} className="card flex flex-col gap-4" style={{ padding: 28 }}>
        <SelectField label="Certification" value={certification} onChange={(e) => setCertification(e.target.value)}>
          <option value="ccar-f">CCAR-F</option>
          <option value="ccar-p">CCAR-P</option>
        </SelectField>
        <SelectField label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
          <option value="mixed">Mixed</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </SelectField>
        <div className="field">
          <label className="field-label">Number of questions</label>
          <div className="flex items-center gap-2 flex-wrap">
            {QUESTION_PRESETS.map((n) => (
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
        <div className="field">
          <label className="field-label">Seconds to answer each question</label>
          <input
            type="number"
            className="input"
            style={{ width: 84 }}
            value={answerSeconds}
            onChange={(e) => setAnswerSeconds(Number(e.target.value))}
            min={5}
          />
        </div>
        <div className="field">
          <label className="field-label">Seconds to show the answer before moving on</label>
          <input
            type="number"
            className="input"
            style={{ width: 84 }}
            value={revealSeconds}
            onChange={(e) => setRevealSeconds(Number(e.target.value))}
            min={3}
          />
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={submitting} variant="clay" block>
          Create live exam
        </Button>
      </form>
    </AppShell>
  );
}
