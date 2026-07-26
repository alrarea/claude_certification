import type { ReactNode } from "react";
import { Spark } from "./Spark";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center px-4" style={{ minHeight: "100vh", background: "var(--color-cream)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="flex flex-col items-center gap-3" style={{ marginBottom: 28 }}>
          <Spark size={26} spinning={false} />
          <h1 className="text-center" style={{ fontSize: 26 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-center text-sm" style={{ color: "var(--color-ink-500)" }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="card" style={{ padding: 32 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
