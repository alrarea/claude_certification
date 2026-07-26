import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";

interface TopicNode {
  id: string;
  title: string;
  examDomain: string | null;
  status: string;
  children: TopicNode[];
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed" ? "var(--color-success)" : status === "in_progress" ? "var(--color-clay)" : "var(--color-border-strong)";
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        marginRight: 8,
      }}
    />
  );
}

function TopicTree({ cert, nodes }: { cert: string; nodes: TopicNode[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <Link
            to={`/learn/${cert}/${node.id}`}
            className="flex items-center"
            style={{ padding: "6px 4px", color: "var(--color-ink-700)", textDecoration: "none" }}
          >
            <StatusDot status={node.status} />
            {node.title}
          </Link>
          {node.children.length > 0 && (
            <ul className="flex flex-col gap-1" style={{ marginLeft: 20 }}>
              <TopicTree cert={cert} nodes={node.children} />
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Learn() {
  const { cert = "ccaf" } = useParams();
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [percentComplete, setPercentComplete] = useState(0);
  const [certName, setCertName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/courses/${cert}/topics`).then((data) => {
      setTopics(data.topics);
      setPercentComplete(data.percentComplete);
      setCertName(data.certification.name);
      setLoading(false);
    });
  }, [cert]);

  if (loading) {
    return (
      <AppShell>
        <FullPageLoader label="Loading course..." />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={720}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 28 }}>{certName}</h1>
        <Link to={`/exam/new?cert=${cert}`} className="btn btn-clay btn-sm" style={{ textDecoration: "none" }}>
          Take an exam →
        </Link>
      </div>
      <div className="flex items-center gap-2" style={{ margin: "12px 0 24px" }}>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" }}>
          <div style={{ width: `${percentComplete}%`, height: "100%", background: "var(--color-clay)" }} />
        </div>
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
          {percentComplete}%
        </span>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <TopicTree cert={cert} nodes={topics} />
      </div>
    </AppShell>
  );
}
