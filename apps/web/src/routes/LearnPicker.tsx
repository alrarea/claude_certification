import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Alert } from "../components/Alert";

interface CertificationSummary {
  code: string;
  name: string;
  description: string | null;
}

export function LearnPicker() {
  const [certifications, setCertifications] = useState<CertificationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/certifications")
      .then((data) => setCertifications(data.certifications))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load certifications"));
  }, []);

  if (error) {
    return (
      <AppShell maxWidth={720}>
        <Alert kind="error">{error}</Alert>
      </AppShell>
    );
  }
  if (!certifications) {
    return (
      <AppShell maxWidth={720}>
        <FullPageLoader label="Loading courses..." />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={720}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Choose a course</h1>
      <div className="flex flex-col gap-4">
        {certifications.map((cert) => (
          <Link
            key={cert.code}
            to={`/learn/${cert.code.toLowerCase()}`}
            className="card flex flex-col"
            style={{ padding: 24, textDecoration: "none", color: "inherit" }}
          >
            <h2 style={{ fontSize: 19, marginBottom: 6 }}>{cert.name}</h2>
            {cert.description && (
              <p className="text-sm" style={{ color: "var(--color-ink-500)" }}>
                {cert.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
