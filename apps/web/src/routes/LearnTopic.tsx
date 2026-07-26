import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Button } from "../components/Button";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/courses/${cert}/topics/${topicId}?mode=${mode}`).then((data) => {
      setTitle(data.topic.title);
      setContentMd(data.contentMd);
      setAvailable(data.available);
      setCompleted(data.progressStatus === "completed");
      setLoading(false);
    });
  }, [cert, topicId, mode]);

  async function markComplete() {
    await apiFetch(`/courses/${cert}/topics/${topicId}/progress`, { method: "POST" });
    setCompleted(true);
  }

  if (loading) {
    return (
      <AppShell>
        <FullPageLoader label="Loading topic..." />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={760}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26 }}>{title}</h1>
        <Link to={`/exam/new?cert=${cert}&topic=${topicId}`} className="text-sm" style={{ color: "var(--color-clay)" }}>
          Practice this topic →
        </Link>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 24 }}>
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`chip ${mode === m ? "active" : ""}`}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        {available ? (
          <div className="prose">
            <ReactMarkdown>{contentMd ?? ""}</ReactMarkdown>
          </div>
        ) : (
          <p className="italic" style={{ color: "var(--color-ink-500)" }}>
            This mode isn't available for this topic yet.
          </p>
        )}
      </div>

      <Button onClick={markComplete} disabled={completed} variant={completed ? "secondary" : "primary"}>
        {completed ? "Completed" : "Mark as complete"}
      </Button>
    </AppShell>
  );
}
