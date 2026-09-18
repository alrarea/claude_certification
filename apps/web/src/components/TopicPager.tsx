import { Link } from "react-router-dom";
import type { ContentMode } from "../lib/contentModes";

export interface TopicLink {
  id: string;
  title: string;
}

interface TopicPagerProps {
  cert: string;
  mode: ContentMode;
  prev: TopicLink | null;
  next: TopicLink | null;
  /**
   * Called when the reader moves forward, which is what finishes a topic.
   * Going back deliberately does not - returning to the previous page is not
   * a statement about having finished this one.
   */
  onAdvance?: () => void;
}

/**
 * Moves to the topic either side of this one, in the order the course page
 * lists them.
 *
 * Each side names the topic it leads to rather than saying "Previous"/"Next".
 * Reading a course is a sequence of decisions about whether to keep going, and
 * the title is what that decision needs; a bare arrow makes the reader go back
 * to the course page to find out what is coming, which is the trip this is
 * here to save.
 *
 * The current mode rides along in the link so paging does not silently drop
 * someone from Concise back into Normal.
 */
export function TopicPager({ cert, mode, prev, next, onAdvance }: TopicPagerProps) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Topic navigation"
      className="flex gap-3"
      style={{
        marginTop: 32,
        paddingTop: 20,
        borderTop: "1px solid var(--color-border)",
        // Each side keeps its half whether or not the other exists, so the
        // last topic's "Previous" does not slide across into the wrong place.
        alignItems: "stretch",
      }}
    >
      <div style={{ flex: 1, display: "flex" }}>
        {prev && <PagerLink cert={cert} mode={mode} topic={prev} direction="prev" />}
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        {next && (
          <PagerLink cert={cert} mode={mode} topic={next} direction="next" onClick={onAdvance} />
        )}
      </div>
    </nav>
  );
}

function PagerLink({
  cert,
  mode,
  topic,
  direction,
  onClick,
}: {
  cert: string;
  mode: ContentMode;
  topic: TopicLink;
  direction: "prev" | "next";
  onClick?: () => void;
}) {
  const isNext = direction === "next";
  return (
    <Link
      to={`/learn/${cert}/${topic.id}?mode=${mode}`}
      onClick={onClick}
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "12px 16px",
        width: "100%",
        textDecoration: "none",
        color: "var(--color-ink-700)",
        textAlign: isNext ? "right" : "left",
      }}
    >
      <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
        {isNext ? "Next →" : "← Previous"}
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.35 }}>{topic.title}</span>
    </Link>
  );
}
