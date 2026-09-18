import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { MarkdownContent } from "../components/MarkdownContent";
import { InDepthWizard } from "../components/InDepthWizard";
import { TopicPager, type TopicLink } from "../components/TopicPager";
import { useLocale } from "../lib/LocaleContext";
import { DEFAULT_LOCALE, type Locale } from "@claude-cert/shared";
import { CONTENT_MODES, MODE_LABELS, type ContentMode } from "../lib/contentModes";

function isContentMode(value: string | null): value is ContentMode {
  return value !== null && (CONTENT_MODES as string[]).includes(value);
}

/**
 * How near the bottom counts as having reached it. Readers stop short of the
 * literal last pixel, and the page has a footer's worth of chrome below the
 * text, so requiring an exact bottom would leave topics unfinished for people
 * who did read them.
 */
const BOTTOM_SLACK = 120;

export function LearnTopic() {
  const { cert = "ccar-f", topicId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode");
  // In-depth never has its own flat page anymore - it always opens the
  // wizard - so this page's own fetched `mode` can only ever be normal or
  // concise. A `?mode=in_depth` link (none currently generated, but kept
  // robust) falls back to Normal underneath and opens the wizard on load.
  const [mode, setMode] = useState<ContentMode>(
    isContentMode(initialMode) && initialMode !== "in_depth" ? initialMode : "normal"
  );
  const [wizardOpen, setWizardOpen] = useState(initialMode === "in_depth");
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  // Which language the body actually came back in, which is not always the
  // one asked for while a translation is still in progress.
  const [contentLocale, setContentLocale] = useState<Locale | null>(null);
  const { locale } = useLocale();
  const [completed, setCompleted] = useState(false);
  const [prev, setPrev] = useState<TopicLink | null>(null);
  const [next, setNext] = useState<TopicLink | null>(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/courses/${cert}/topics/${topicId}?mode=${mode}&locale=${locale}`).then((data) => {
      setTitle(data.topic.title);
      setContentMd(data.contentMd);
      setAvailable(data.available);
      setContentLocale(data.contentLocale ?? null);
      setCompleted(data.progressStatus === "completed");
      setPrev(data.prev ?? null);
      setNext(data.next ?? null);
      setLoading(false);
    });
  }, [cert, topicId, mode, locale]);

  // Paging keeps the URL but swaps the topic, so without this the next topic
  // opens scrolled to wherever the reader left the last one - which reads as a
  // page that failed to load its beginning.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [topicId]);

  // Finishing is something the reader does, not something they declare, so it
  // is fired by reaching the end or moving on rather than by a button. Both
  // triggers land here, and the ref makes it at-most-once per topic: the
  // observer can fire repeatedly while someone scrolls around near the bottom,
  // and paging forward from an already-finished topic should not re-post.
  const markedRef = useRef(false);
  const markComplete = useCallback(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    setCompleted(true);
    // Not awaited: this rides alongside a navigation the reader already
    // started, and a slow write should never hold up the next page.
    apiFetch(`/courses/${cert}/topics/${topicId}/progress`, { method: "POST" }).catch(() => {
      // Progress is a convenience, not the content, so a failed write is not
      // worth an error in the reader's face - but it must not leave the page
      // claiming a tick the server never stored. Roll both back together so
      // the next trigger can try again.
      markedRef.current = false;
      setCompleted(false);
    });
  }, [cert, topicId]);

  // Re-arm per topic. Paging into an already-finished topic must not re-post,
  // and paging into an unfinished one must be able to.
  useEffect(() => {
    markedRef.current = completed;
  }, [topicId, completed]);

  // Reaching the end of the text is the other way to finish. The sentinel sits
  // directly after the content, so what counts is the end of the topic rather
  // than the end of the page furniture below it.
  useEffect(() => {
    const sentinel = endRef.current;
    if (!sentinel || loading || completed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        // A topic short enough to fit on screen has its end visible the moment
        // it loads, and completing on that would just be completing on open -
        // which is the thing this is meant to avoid. Those finish via Next.
        const scrollable =
          document.documentElement.scrollHeight > window.innerHeight + BOTTOM_SLACK;
        if (scrollable) markComplete();
      },
      { rootMargin: `0px 0px -${BOTTOM_SLACK}px 0px` }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, completed, markComplete, topicId]);

  if (loading) {
    return (
      <AppShell>
        <FullPageLoader label="Loading topic..." />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={760}>
      <Link
        to={`/learn/${cert}`}
        className="text-sm"
        style={{ color: "var(--color-ink-500)", display: "inline-block", marginBottom: 12 }}
      >
        ← Back to course
      </Link>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26 }}>{title}</h1>
        <Link to={`/exam/new?cert=${cert}&topic=${topicId}`} className="text-sm" style={{ color: "var(--color-clay)" }}>
          Practice this topic →
        </Link>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 24 }}>
        {CONTENT_MODES.map((m) => (
          <button
            key={m}
            onClick={() => (m === "in_depth" ? setWizardOpen(true) : setMode(m))}
            className={`chip ${(m === "in_depth" ? wizardOpen : mode === m) ? "active" : ""}`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        {available ? (
          <div className="prose">
            {contentLocale && contentLocale !== locale && (
              <p className="italic" style={{ color: "var(--color-ink-500)", marginTop: 0 }}>
                ഈ വിഷയം ഇതുവരെ മലയാളത്തിലേക്ക് പരിഭാഷപ്പെടുത്തിയിട്ടില്ല — ഇംഗ്ലീഷ് കാണിക്കുന്നു.
              </p>
            )}
            <MarkdownContent locale={contentLocale ?? DEFAULT_LOCALE}>
              {contentMd ?? ""}
            </MarkdownContent>
          </div>
        ) : (
          <p className="italic" style={{ color: "var(--color-ink-500)" }}>
            This mode isn't available for this topic yet.
          </p>
        )}
      </div>

      {/* Marks the end of the topic itself, above the navigation below it. */}
      <div ref={endRef} aria-hidden="true" />

      {completed && (
        <p className="text-sm" style={{ color: "var(--color-success)", margin: 0 }}>
          ✓ Completed
        </p>
      )}

      <TopicPager cert={cert} mode={mode} prev={prev} next={next} onAdvance={markComplete} />

      {wizardOpen && (
        <InDepthWizard
          cert={cert}
          topicId={topicId}
          topicTitle={title}
          onClose={(wasCompleted) => {
            setWizardOpen(false);
            if (wasCompleted) setCompleted(true);
          }}
        />
      )}
    </AppShell>
  );
}
