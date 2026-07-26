interface SparkProps {
  size?: number;
  spinning?: boolean;
  className?: string;
}

export function Spark({ size = 20, spinning = true, className = "" }: SparkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={[spinning ? "spark" : "", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <path d="M12 0c0 6 1 10 12 12-11 2-12 6-12 12 0-6-1-10-12-12C11 10 12 6 12 0Z" />
    </svg>
  );
}
