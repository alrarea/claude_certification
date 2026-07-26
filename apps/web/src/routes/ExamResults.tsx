import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Alert } from "../components/Alert";

interface Results {
  scorePct: number;
  byTopic: { topicId: string; title: string; correct: number; total: number }[];
  byDifficulty: { difficulty: string; correct: number; total: number }[];
  missed: { questionId: string; questionText: string; topicId: string; topicTitle: string }[];
}

export function ExamResults() {
  const { id = "" } = useParams();
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/exams/${id}/results`)
      .then(setResults)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load results"));
  }, [id]);

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

  return (
    <AppShell maxWidth={700}>
      <div className="card flex flex-col items-center" style={{ padding: "32px 24px", marginBottom: 28 }}>
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
          Your score
        </span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 56, color: "var(--color-clay)" }}>
          {results.scorePct.toFixed(0)}%
        </span>
      </div>

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
          <ul className="flex flex-col gap-3 text-sm">
            {results.missed.map((m) => (
              <li key={m.questionId}>
                <p style={{ marginBottom: 4 }}>{m.questionText}</p>
                <Link to={`/learn/ccaf/${m.topicId}`} style={{ color: "var(--color-clay)" }}>
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
