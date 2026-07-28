import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { SelectField } from "../components/TextField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

const PRESETS = [10, 20, 40, 60];

interface LiveExamSummary {
  id: string;
  certification: string;
  certificationName: string;
  difficulty: string;
  phase: string;
  questionCount: number;
  participantCount: number;
}

function LiveExamsSection() {
  const [liveExams, setLiveExams] = useState<LiveExamSummary[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch("/live-exams");
      setLiveExams(data.liveExams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live exams");
    }
  }

  useEffect(() => {
    load();
    apiFetch("/profile")
      .then((p) => setIsAdmin(p.role === "admin" || p.role === "super_admin"))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 19 }}>Live exams</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load}>
            Refresh
          </Button>
          {isAdmin && (
            <Link to="/live-exams/new" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
              + Host a live exam
            </Link>
          )}
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {liveExams && liveExams.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-ink-500)" }}>
          No live exams right now.
        </p>
      )}
      {liveExams && liveExams.length > 0 && (
        <div className="flex flex-col gap-3">
          {liveExams.map((le) => (
            <div key={le.id} className="card flex items-center justify-between" style={{ padding: "16px 20px" }}>
              <div>
                <div style={{ fontSize: 15 }}>
                  {le.certificationName} &middot; <span style={{ textTransform: "capitalize" }}>{le.difficulty}</span>
                </div>
                <div className="text-xs" style={{ color: "var(--color-ink-500)" }}>
                  {le.questionCount} questions &middot; {le.participantCount} joined &middot; {le.phase === "lobby" ? "waiting to start" : "in progress"}
                </div>
              </div>
              <Link to={`/live-exam/${le.id}`} className="btn btn-clay btn-sm" style={{ textDecoration: "none" }}>
                Join
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
      <LiveExamsSection />
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
