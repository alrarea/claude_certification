import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

interface ExamQuestion {
  questionId: string;
  questionText: string;
  options: { id: string; optionText: string }[];
  selectedOptionId: string | null;
  isCorrect?: boolean;
  correctOptionId?: string;
  explanations?: Record<string, string>;
}

export function ExamInProgress() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch(`/exams/${id}`);
    setQuestions(data.questions);
    const firstUnanswered = data.questions.findIndex((q: ExamQuestion) => !q.selectedOptionId);
    setCurrent(firstUnanswered === -1 ? 0 : firstUnanswered);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load exam"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function selectAnswer(optionId: string) {
    const q = questions[current];
    try {
      const result = await apiFetch(`/exams/${id}/questions/${q.questionId}/answer`, {
        method: "POST",
        body: JSON.stringify({ selectedOptionId: optionId }),
      });
      setQuestions((qs) => qs.map((item, i) => (i === current ? { ...item, selectedOptionId: optionId, ...result } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    }
  }

  async function finish() {
    try {
      await apiFetch(`/exams/${id}/complete`, { method: "POST" });
      navigate(`/exam/${id}/results`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete exam");
    }
  }

  if (questions.length === 0) {
    return (
      <AppShell maxWidth={700}>
        <FullPageLoader label="Loading exam..." />
      </AppShell>
    );
  }

  const q = questions[current];
  const showFeedback = !!q.selectedOptionId;

  return (
    <AppShell maxWidth={700}>
      <p className="text-sm" style={{ color: "var(--color-ink-500)", marginBottom: 8 }}>
        Question {current + 1} of {questions.length}
      </p>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>{q.questionText}</h1>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-3" style={{ marginBottom: 28 }}>
        {q.options.map((o) => {
          const isSelected = q.selectedOptionId === o.id;
          const isCorrectOption = showFeedback && q.correctOptionId === o.id;
          return (
            <div key={o.id}>
              <button
                onClick={() => !q.selectedOptionId && selectAnswer(o.id)}
                disabled={!!q.selectedOptionId}
                className="card"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 18px",
                  cursor: q.selectedOptionId ? "default" : "pointer",
                  borderColor: isCorrectOption ? "var(--color-success, #2f6f4f)" : isSelected ? "var(--color-ink)" : undefined,
                  background: isCorrectOption ? "var(--color-success-bg)" : "#fff",
                  fontSize: 15,
                }}
              >
                {o.optionText}
              </button>
              {showFeedback && q.explanations?.[o.id] && (
                <p className="text-xs" style={{ color: "var(--color-ink-500)", marginLeft: 4, marginTop: 6 }}>
                  {q.explanations[o.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setCurrent((i) => Math.max(0, i - 1))} disabled={current === 0}>
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button variant="secondary" onClick={() => setCurrent((i) => i + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="clay" onClick={finish}>
            Finish exam
          </Button>
        )}
      </div>
    </AppShell>
  );
}
