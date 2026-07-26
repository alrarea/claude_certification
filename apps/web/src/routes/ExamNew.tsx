import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

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
    <div className="max-w-md mx-auto mt-12 space-y-4">
      <h1 className="text-xl font-semibold">New exam</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        {!lockedCert && (
          <select
            className="w-full border rounded px-3 py-2"
            value={certification}
            onChange={(e) => setCertification(e.target.value)}
          >
            <option value="ccaf">CCAF</option>
            <option value="ccap">CCAP</option>
          </select>
        )}
        <select
          className="w-full border rounded px-3 py-2"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
        >
          <option value="mixed">Mixed</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select
          className="w-full border rounded px-3 py-2"
          value={feedbackMode}
          onChange={(e) => setFeedbackMode(e.target.value as typeof feedbackMode)}
        >
          <option value="immediate">Immediate feedback</option>
          <option value="end_of_set">Feedback at the end</option>
        </select>
        <div className="flex gap-2">
          {PRESETS.map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setQuestionCount(n)}
              className={`px-3 py-1 rounded border ${questionCount === n ? "bg-black text-white" : ""}`}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            className="w-20 border rounded px-2"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            min={1}
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          disabled={submitting}
          className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-50"
        >
          Start exam
        </button>
      </form>
    </div>
  );
}
