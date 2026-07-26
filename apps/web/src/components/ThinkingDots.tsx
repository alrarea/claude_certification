export function ThinkingDots({ className = "" }: { className?: string }) {
  return (
    <span className={["thinking-dots", className].filter(Boolean).join(" ")}>
      <span />
      <span />
      <span />
    </span>
  );
}
