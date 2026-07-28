import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  emailVerified: boolean;
  createdAt: string;
  topicsStarted: number;
  topicsCompleted: number;
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [otpByUser, setOtpByUser] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await apiFetch("/admin/users");
    setUsers(data.users);
  }

  useEffect(() => {
    Promise.all([
      apiFetch("/profile").then((p) => setMyRole(p.role)),
      load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load")),
    ]).finally(() => setLoading(false));
  }, []);

  async function setRole(userId: string, role: "user" | "admin") {
    try {
      await apiFetch(`/admin/users/${userId}/role`, { method: "POST", body: JSON.stringify({ role }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function viewOtp(userId: string) {
    try {
      const data = await apiFetch(`/admin/users/${userId}/otp`);
      setOtpByUser((s) => ({ ...s, [userId]: `${data.code} (expires ${new Date(data.expiresAt).toLocaleTimeString()})` }));
    } catch (err) {
      setOtpByUser((s) => ({ ...s, [userId]: err instanceof Error ? err.message : "No active OTP" }));
    }
  }

  async function copyOtps() {
    setCopying(true);
    setCopyMessage(null);
    try {
      const data = await apiFetch("/admin/otps");
      const otps: { name: string; code: string }[] = data.otps;
      if (otps.length === 0) {
        setCopyMessage("No active OTPs right now.");
        return;
      }
      const text = otps.map((o) => `${o.name}-${o.code}`).join("\n");
      await navigator.clipboard.writeText(text);
      setCopyMessage(`Copied ${otps.length} OTP${otps.length === 1 ? "" : "s"} to clipboard.`);
    } catch (err) {
      setCopyMessage(err instanceof Error ? err.message : "Failed to copy OTPs");
    } finally {
      setCopying(false);
    }
  }

  const isSuperAdmin = myRole === "super_admin";

  if (loading) {
    return (
      <AppShell maxWidth={960}>
        <FullPageLoader label="Loading users..." />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={960}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28 }}>Users</h1>
        {isSuperAdmin && (
          <Button size="sm" variant="secondary" loading={copying} onClick={copyOtps}>
            Copy OTPs
          </Button>
        )}
      </div>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}
      {copyMessage && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind={copyMessage.startsWith("Copied") ? "success" : "error"}>{copyMessage}</Alert>
        </div>
      )}
      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "var(--color-cream-100)", borderBottom: "1px solid var(--color-border)" }}>
              <th style={{ padding: "12px 16px" }}>Name</th>
              <th style={{ padding: "12px 16px" }}>Email</th>
              <th style={{ padding: "12px 16px" }}>Role</th>
              <th style={{ padding: "12px 16px" }}>Verified</th>
              <th style={{ padding: "12px 16px" }}>Started</th>
              <th style={{ padding: "12px 16px" }}>Completed</th>
              {isSuperAdmin && <th style={{ padding: "12px 16px" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "12px 16px" }}>{u.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--color-ink-500)" }}>{u.email}</td>
                <td style={{ padding: "12px 16px" }}>{u.role}</td>
                <td style={{ padding: "12px 16px" }}>{u.emailVerified ? "yes" : "no"}</td>
                <td style={{ padding: "12px 16px" }}>{u.topicsStarted}</td>
                <td style={{ padding: "12px 16px" }}>{u.topicsCompleted}</td>
                {isSuperAdmin && (
                  <td style={{ padding: "12px 16px" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.role !== "super_admin" && (
                        <Button size="sm" variant="secondary" onClick={() => setRole(u.id, u.role === "admin" ? "user" : "admin")}>
                          {u.role === "admin" ? "Revoke admin" : "Make admin"}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => viewOtp(u.id)}>
                        View OTP
                      </Button>
                    </div>
                    {otpByUser[u.id] && (
                      <div className="text-xs" style={{ color: "var(--color-ink-500)", marginTop: 4 }}>
                        {otpByUser[u.id]}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
