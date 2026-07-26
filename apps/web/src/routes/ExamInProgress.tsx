import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

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
  const [feedbackMode, setFeedbackMode] = useState<"immediate" | "end_of_set">("immediate");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch(`/exams/${id}`);
    setFeedbackMode(data.feedbackMode);
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
      setQuestions((qs) =>
        qs.map((item, i) =>
          i === current ? { ...item, selectedOptionId: optionId, ...result } : item
        )
      );
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

  if (questions.length === 0) return <div className="max-w-2xl mx-auto mt-12">Loading...</div>;

  const q = questions[current];
  const showFeedback = feedbackMode === "immediate" && q.selectedOptionId;

  return (
    <div className="max-w-2xl mx-auto mt-12 space-y-4">
      <p className="text-sm text-gray-600">
        Question {current + 1} of {questions.length}
      </p>
      <h1 className="text-lg font-medium">{q.questionText}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-2">
        {q.options.map((o) => {
          const isSelected = q.selectedOptionId === o.id;
          const isCorrectOption = showFeedback && q.correctOptionId === o.id;
          return (
            <div key={o.id}>
              <button
                onClick={() => !q.selectedOptionId && selectAnswer(o.id)}
                disabled={!!q.selectedOptionId}
                className={`w-full text-left border rounded px-3 py-2 ${
                  isSelected ? "border-black" : ""
                } ${isCorrectOption ? "bg-green-50 border-green-600" : ""}`}
              >
                {o.optionText}
              </button>
              {showFeedback && q.explanations?.[o.id] && (
                <p className="text-xs text-gray-600 ml-2 mt-1">{q.explanations[o.id]}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={() => setCurrent((i) => Math.max(0, i - 1))}
          disabled={current === 0}
          className="text-sm underline disabled:opacity-30"
        >
          Previous
        </button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent((i) => i + 1)} className="text-sm underline">
            Next
          </button>
        ) : (
          <button onClick={finish} className="bg-black text-white rounded px-3 py-2">
            Finish exam
          </button>
        )}
      </div>
    </div>
  );
}
