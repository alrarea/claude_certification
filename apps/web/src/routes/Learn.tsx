import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { MarkdownContent } from "../components/MarkdownContent";
import { CONTENT_MODES, MODE_LABELS, type ContentMode } from "../lib/contentModes";

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

interface TopicTreeProps {
  cert: string;
  nodes: TopicNode[];
  mode: ContentMode;
  expandedIds: Set<string>;
  onToggleExpand: (topicId: string) => void;
  contentCache: Record<string, string | null>;
  loadingIds: Set<string>;
}

function TopicTree({ cert, nodes, mode, expandedIds, onToggleExpand, contentCache, loadingIds }: TopicTreeProps) {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => {
        const isExpanded = expandedIds.has(node.id);
        return (
          <li key={node.id}>
            {mode === "concise" ? (
              <button
                onClick={() => onToggleExpand(node.id)}
                className="flex items-center"
                style={{
                  padding: "6px 4px",
                  color: "var(--color-ink-700)",
                  background: "none",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                <StatusDot status={node.status} />
                {node.title}
                <span style={{ marginLeft: "auto", color: "var(--color-ink-500)", fontSize: 12 }}>
                  {isExpanded ? "▾" : "▸"}
                </span>
              </button>
            ) : (
              <Link
                to={`/learn/${cert}/${node.id}?mode=${mode}`}
                className="flex items-center"
                style={{ padding: "6px 4px", color: "var(--color-ink-700)", textDecoration: "none" }}
              >
                <StatusDot status={node.status} />
                {node.title}
              </Link>
            )}

            {mode === "concise" && isExpanded && (
              <div className="card" style={{ margin: "8px 0 8px 20px", padding: 20 }}>
                {loadingIds.has(node.id) ? (
                  <p className="text-sm" style={{ color: "var(--color-ink-500)" }}>
                    Loading...
                  </p>
                ) : contentCache[node.id] ? (
                  <div className="prose">
                    <MarkdownContent>{contentCache[node.id]!}</MarkdownContent>
                  </div>
                ) : (
                  <p className="italic text-sm" style={{ color: "var(--color-ink-500)" }}>
                    Concise notes aren't available for this topic yet.
                  </p>
                )}
              </div>
            )}

            {node.children.length > 0 && (
              <ul className="flex flex-col gap-1" style={{ marginLeft: 20 }}>
                <TopicTree
                  cert={cert}
                  nodes={node.children}
                  mode={mode}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  contentCache={contentCache}
                  loadingIds={loadingIds}
                />
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Learn() {
  const { cert = "ccar-f" } = useParams();
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [percentComplete, setPercentComplete] = useState(0);
  const [certName, setCertName] = useState("");
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<ContentMode>("normal");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contentCache, setContentCache] = useState<Record<string, string | null>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    apiFetch(`/courses/${cert}/topics`).then((data) => {
      setTopics(data.topics);
      setPercentComplete(data.percentComplete);
      setCertName(data.certification.name);
      setLoading(false);
    });
  }, [cert]);

  function toggleExpand(topicId: string) {
    const wasExpanded = expandedIds.has(topicId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (wasExpanded) next.delete(topicId);
      else next.add(topicId);
      return next;
    });

    // Only fetch on the transition into "expanded", and only once per topic -
    // collapsing and re-expanding reuses whatever's already in contentCache.
    if (!wasExpanded && !(topicId in contentCache) && !loadingIds.has(topicId)) {
      setLoadingIds((prev) => new Set(prev).add(topicId));
      apiFetch(`/courses/${cert}/topics/${topicId}?mode=concise`)
        .then((data) => {
          setContentCache((prev) => ({ ...prev, [topicId]: data.available ? data.contentMd : null }));
        })
        .catch(() => {
          setContentCache((prev) => ({ ...prev, [topicId]: null }));
        })
        .finally(() => {
          setLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(topicId);
            return next;
          });
        });
    }
  }

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
      <div className="flex items-center gap-2" style={{ margin: "12px 0 16px" }}>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" }}>
          <div style={{ width: `${percentComplete}%`, height: "100%", background: "var(--color-clay)" }} />
        </div>
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
          {percentComplete}%
        </span>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 24 }}>
        {CONTENT_MODES.map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`chip ${mode === m ? "active" : ""}`}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <TopicTree
          cert={cert}
          nodes={topics}
          mode={mode}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          contentCache={contentCache}
          loadingIds={loadingIds}
        />
      </div>
    </AppShell>
  );
}
