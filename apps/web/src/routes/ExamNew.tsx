import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { SelectField } from "../components/TextField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

// The real CCAR-F exam is 60 questions, CCAR-P is 63 - options run from the
// smallest count that still gives every exam-blueprint domain a shot at
// representation up to double the real exam length, in the certification's
// own clean step size (60/3=20, 63/3=21) so the real exam length always
// lands on one of the presets.
const QUESTION_COUNT_PRESETS: Record<string, number[]> = {
  "ccar-f": [20, 40, 60, 80, 100, 120],
  "ccar-p": [21, 42, 63, 84, 105, 126],
};
const REAL_EXAM_LENGTH: Record<string, number> = { "ccar-f": 60, "ccar-p": 63 };

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

  const initialCert = lockedCert ?? "ccar-f";
  const [certification, setCertification] = useState(initialCert);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [questionCount, setQuestionCount] = useState(REAL_EXAM_LENGTH[initialCert] ?? 60);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const presets = QUESTION_COUNT_PRESETS[certification] ?? QUESTION_COUNT_PRESETS["ccar-f"];
  const realLength = REAL_EXAM_LENGTH[certification] ?? 60;

  function onCertificationChange(next: string) {
    setCertification(next);
    // Presets differ per certification (CCAR-F steps of 20, CCAR-P steps of 21) -
    // snap the count back to that cert's real exam length rather than
    // leaving a value that doesn't belong to the new preset list.
    setQuestionCount(REAL_EXAM_LENGTH[next] ?? 60);
  }

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
          <SelectField label="Certification" value={certification} onChange={(e) => onCertificationChange(e.target.value)}>
            <option value="ccar-f">CCAR-F</option>
            <option value="ccar-p">CCAR-P</option>
          </SelectField>
        )}
        <SelectField label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
          <option value="mixed">Mixed</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </SelectField>
        <div className="field">
          <label className="field-label">Number of questions</label>
          <div className="flex items-center gap-2 flex-wrap">
            {presets.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setQuestionCount(n)}
                className={`chip ${questionCount === n ? "active" : ""}`}
                title={n === realLength ? "Same length as the real exam" : undefined}
              >
                {n}
                {n === realLength ? " (real length)" : ""}
              </button>
            ))}
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
