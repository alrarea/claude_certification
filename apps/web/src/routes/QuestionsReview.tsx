import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

interface PendingQuestion {
  id: string;
  certification: string;
  topicTitle: string;
  difficulty: string;
  source: string;
  questionText: string;
  options: { id: string; optionText: string; isCorrect: boolean; explanation: string }[];
}

export function QuestionsReview() {
  const [pending, setPending] = useState<PendingQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await apiFetch("/questions/pending");
    setPending(data.questions);
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function review(id: string, decision: "approved" | "rejected") {
    try {
      await apiFetch(`/questions/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review");
    }
  }

  if (loading) {
    return (
      <AppShell maxWidth={720}>
        <FullPageLoader label="Loading pending questions..." />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={720}>
      <Link
        to="/questions/manage"
        className="text-sm"
        style={{ color: "var(--color-ink-500)", display: "inline-block", marginBottom: 12 }}
      >
        ← Back to question bank
      </Link>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Pending questions ({pending.length})</h1>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {pending.map((q) => (
          <div key={q.id} className="card flex flex-col gap-3" style={{ padding: 24 }}>
            <p className="text-xs" style={{ color: "var(--color-ink-500)" }}>
              {q.certification} · {q.topicTitle} · {q.difficulty} · {q.source}
            </p>
            <p style={{ fontWeight: 500 }}>{q.questionText}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {q.options.map((o) => (
                <li key={o.id} style={o.isCorrect ? { color: "var(--color-success)", fontWeight: 500 } : undefined}>
                  {o.optionText} — {o.explanation}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button size="sm" variant="secondary" onClick={() => review(q.id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="ghost" style={{ color: "var(--color-error)" }} onClick={() => review(q.id, "rejected")}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
