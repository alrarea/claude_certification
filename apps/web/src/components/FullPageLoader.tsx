import { Spark } from "./Spark";

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "50vh" }}>
      <Spark size={32} />
      {label && (
        <p className="text-sm" style={{ color: "var(--color-ink-500)" }}>
          {label}
        </p>
      )}
    </div>
  );
}
