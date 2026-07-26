import type { ReactNode } from "react";

export function Alert({ kind = "error", children }: { kind?: "error" | "success"; children: ReactNode }) {
  return <p className={`alert alert-${kind}`}>{children}</p>;
}
