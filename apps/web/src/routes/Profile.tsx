import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { TextField } from "../components/TextField";
import { PasswordField } from "../components/PasswordField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  hasAnthropicKey: boolean;
  anthropicKeyLast4: string | null;
}

export function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Record<string, string | null>>({});

  useEffect(() => {
    apiFetch("/profile").then((data) => {
      setProfile(data);
      setName(data.name);
    });
  }, []);

  async function onSaveName(e: FormEvent) {
    e.preventDefault();
    setStatus((s) => ({ ...s, name: null }));
    try {
      const data = await apiFetch("/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      setProfile(data);
      setStatus((s) => ({ ...s, name: "Saved" }));
    } catch (err) {
      setStatus((s) => ({ ...s, name: err instanceof Error ? err.message : "Failed" }));
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setStatus((s) => ({ ...s, password: null }));
    try {
      await apiFetch("/profile/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setStatus((s) => ({ ...s, password: "Password changed" }));
    } catch (err) {
      setStatus((s) => ({ ...s, password: err instanceof Error ? err.message : "Failed" }));
    }
  }

  async function onSaveKey(e: FormEvent) {
    e.preventDefault();
    setStatus((s) => ({ ...s, apiKey: "Validating..." }));
    try {
      const data = await apiFetch("/profile/api-key", { method: "POST", body: JSON.stringify({ apiKey }) });
      setApiKey("");
      setProfile((p) => (p ? { ...p, hasAnthropicKey: true, anthropicKeyLast4: data.anthropicKeyLast4 } : p));
      setStatus((s) => ({ ...s, apiKey: "Saved" }));
    } catch (err) {
      setStatus((s) => ({ ...s, apiKey: err instanceof Error ? err.message : "Failed" }));
    }
  }

  async function onRemoveKey() {
    await apiFetch("/profile/api-key", { method: "DELETE" });
    setProfile((p) => (p ? { ...p, hasAnthropicKey: false, anthropicKeyLast4: null } : p));
  }

  if (!profile) {
    return (
      <AppShell>
        <FullPageLoader label="Loading profile..." />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={560}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Profile</h1>
      <div className="flex flex-col gap-1" style={{ marginBottom: 32 }}>
        <Link to="/questions/manage" className="text-sm" style={{ color: "var(--color-clay)" }}>
          Manage question bank →
        </Link>
        {profile.role !== "user" && (
          <>
            <Link to="/admin/users" className="text-sm" style={{ color: "var(--color-clay)" }}>
              Manage users →
            </Link>
            <Link to="/questions/manage/review" className="text-sm" style={{ color: "var(--color-clay)" }}>
              Review pending questions →
            </Link>
          </>
        )}
      </div>

      <div className="card flex flex-col gap-4" style={{ padding: 24, marginBottom: 20 }}>
        <form onSubmit={onSaveName} className="flex flex-col gap-3">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary">
              Save
            </Button>
            {status.name && <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>{status.name}</span>}
          </div>
        </form>
      </div>

      <div className="card flex flex-col gap-4" style={{ padding: 24, marginBottom: 20 }}>
        <form onSubmit={onChangePassword} className="flex flex-col gap-3">
          <p className="field-label">Change password</p>
          <PasswordField
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <PasswordField
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary">
              Change password
            </Button>
            {status.password && <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>{status.password}</span>}
          </div>
        </form>
      </div>

      <div className="card flex flex-col gap-3" style={{ padding: 24 }}>
        <p className="field-label">Anthropic API key</p>
        {profile.hasAnthropicKey ? (
          <div className="flex items-center gap-3">
            <span className="text-sm">sk-ant-...{profile.anthropicKeyLast4}</span>
            <Button size="sm" variant="ghost" onClick={onRemoveKey} style={{ color: "var(--color-error)" }}>
              Remove key
            </Button>
          </div>
        ) : (
          <form onSubmit={onSaveKey} className="flex flex-col gap-3">
            <TextField placeholder="sk-ant-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <Button size="sm" variant="secondary">
              Save key
            </Button>
          </form>
        )}
        {status.apiKey && <Alert kind={status.apiKey === "Saved" ? "success" : "error"}>{status.apiKey}</Alert>}
      </div>
    </AppShell>
  );
}
