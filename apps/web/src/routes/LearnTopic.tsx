import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "../lib/api";

type Mode = "in_depth" | "normal" | "concise";

const MODE_LABELS: Record<Mode, string> = {
  in_depth: "In-depth",
  normal: "Normal",
  concise: "Concise",
};

export function LearnTopic() {
  const { cert = "ccaf", topicId = "" } = useParams();
  const [mode, setMode] = useState<Mode>("normal");
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    apiFetch(`/courses/${cert}/topics/${topicId}?mode=${mode}`).then((data) => {
      setTitle(data.topic.title);
      setContentMd(data.contentMd);
      setAvailable(data.available);
      setCompleted(data.progressStatus === "completed");
    });
  }, [cert, topicId, mode]);

  async function markComplete() {
    await apiFetch(`/courses/${cert}/topics/${topicId}/progress`, { method: "POST" });
    setCompleted(true);
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Link to={`/exam/new?cert=${cert}&topic=${topicId}`} className="text-sm underline">
          Practice this topic →
        </Link>
      </div>

      <div className="flex gap-2">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-sm px-3 py-1 rounded border ${mode === m ? "bg-black text-white" : ""}`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {available ? (
        <div className="prose max-w-none">
          <ReactMarkdown>{contentMd ?? ""}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-gray-500 italic">This mode isn't available for this topic yet.</p>
      )}

      <button
        onClick={markComplete}
        disabled={completed}
        className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
      >
        {completed ? "Completed" : "Mark as complete"}
      </button>
    </div>
  );
}
