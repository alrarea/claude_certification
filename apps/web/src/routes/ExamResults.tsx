import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

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

  if (error) return <div className="max-w-2xl mx-auto mt-12 text-red-600">{error}</div>;
  if (!results) return <div className="max-w-2xl mx-auto mt-12">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto mt-12 space-y-6">
      <h1 className="text-2xl font-semibold">Score: {results.scorePct.toFixed(0)}%</h1>

      <div>
        <h2 className="font-medium mb-2">By topic</h2>
        <ul className="space-y-1 text-sm">
          {results.byTopic.map((t) => (
            <li key={t.topicId}>
              {t.title}: {t.correct}/{t.total}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-medium mb-2">By difficulty</h2>
        <ul className="space-y-1 text-sm">
          {results.byDifficulty.map((d) => (
            <li key={d.difficulty}>
              {d.difficulty}: {d.correct}/{d.total}
            </li>
          ))}
        </ul>
      </div>

      {results.missed.length > 0 && (
        <div>
          <h2 className="font-medium mb-2">Missed questions</h2>
          <ul className="space-y-2 text-sm">
            {results.missed.map((m) => (
              <li key={m.questionId}>
                {m.questionText}{" "}
                <Link to={`/learn/ccaf/${m.topicId}`} className="underline text-blue-700">
                  Review {m.topicTitle} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
