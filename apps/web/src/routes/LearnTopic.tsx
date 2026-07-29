import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Button } from "../components/Button";
import { MarkdownContent } from "../components/MarkdownContent";
import { CONTENT_MODES, MODE_LABELS, type ContentMode } from "../lib/contentModes";

function isContentMode(value: string | null): value is ContentMode {
  return value !== null && (CONTENT_MODES as string[]).includes(value);
}

export function LearnTopic() {
  const { cert = "ccar-f", topicId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode");
  // The course-overview page's mode selector carries its choice here via
  // ?mode= so picking "In-depth" out there and clicking a topic lands you
  // already in In-depth mode, instead of always resetting to Normal.
  const [mode, setMode] = useState<ContentMode>(isContentMode(initialMode) ? initialMode : "normal");
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
        {CONTENT_MODES.map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`chip ${mode === m ? "active" : ""}`}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        {available ? (
          <div className="prose">
            <MarkdownContent>{contentMd ?? ""}</MarkdownContent>
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
