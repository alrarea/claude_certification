import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
  initialized = true;
}

export function Mermaid({ chart }: { chart: string }) {
  const rawId = useId();
  const renderId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureInitialized();
    mermaid
      .render(renderId, chart)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  if (error) {
    return (
      <p className="text-xs italic" style={{ color: "var(--color-ink-500)" }}>
        (diagram couldn't be rendered)
      </p>
    );
  }
  if (!svg) {
    return (
      <p className="text-xs" style={{ color: "var(--color-ink-500)" }}>
        Rendering diagram...
      </p>
    );
  }
  return (
    <div
      style={{ display: "flex", justifyContent: "center", margin: "16px 0", maxWidth: "100%", overflowX: "auto" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
