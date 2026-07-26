import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

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

  async function load() {
    const data = await apiFetch("/questions/pending");
    setPending(data.questions);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  async function review(id: string, decision: "approved" | "rejected") {
    try {
      await apiFetch(`/questions/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review");
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 space-y-6">
      <h1 className="text-xl font-semibold">Pending questions ({pending.length})</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {pending.map((q) => (
        <div key={q.id} className="border rounded p-4 space-y-2">
          <p className="text-xs text-gray-500">
            {q.certification} · {q.topicTitle} · {q.difficulty} · {q.source}
          </p>
          <p className="font-medium">{q.questionText}</p>
          <ul className="text-sm space-y-1">
            {q.options.map((o) => (
              <li key={o.id} className={o.isCorrect ? "text-green-700 font-medium" : ""}>
                {o.optionText} - {o.explanation}
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button onClick={() => review(q.id, "approved")} className="text-sm text-green-700 underline">
              Approve
            </button>
            <button onClick={() => review(q.id, "rejected")} className="text-sm text-red-700 underline">
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
