import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * An English technical term inside translated prose, with its meaning one
 * hover — or one tap — away.
 *
 * Hover alone would strand every phone user, which is most of them, so the
 * term is a real button: it opens on tap and on keyboard focus as well as on
 * pointer hover, and the meaning is also exposed through aria-label so a
 * screen reader reaches it without any pointer at all. A bare `title`
 * attribute would have been one line, but it is unreachable on touch and
 * unreliable for assistive tech.
 */
export function GlossaryTerm({
  term,
  meaning,
  children,
}: {
  term: string;
  meaning: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="glossary-term"
      role="button"
      tabIndex={0}
      aria-label={`${term}: ${meaning}`}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="glossary-tip" role="tooltip">
          {meaning}
        </span>
      )}
    </span>
  );
}
