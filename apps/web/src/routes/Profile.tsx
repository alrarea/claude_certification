import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

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

  if (!profile) return <div className="max-w-md mx-auto mt-16">Loading...</div>;

  return (
    <div className="max-w-md mx-auto mt-16 space-y-8">
      <h1 className="text-xl font-semibold">Profile</h1>
      {profile.role !== "user" && (
        <Link to="/admin/users" className="text-sm underline">
          Manage users →
        </Link>
      )}

      <form onSubmit={onSaveName} className="space-y-2">
        <label className="block text-sm text-gray-600">Name</label>
        <input className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="text-sm underline">Save</button>
        {status.name && <p className="text-sm">{status.name}</p>}
      </form>

      <form onSubmit={onChangePassword} className="space-y-2">
        <label className="block text-sm text-gray-600">Change password</label>
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button className="text-sm underline">Change password</button>
        {status.password && <p className="text-sm">{status.password}</p>}
      </form>

      <div className="space-y-2">
        <label className="block text-sm text-gray-600">Anthropic API key</label>
        {profile.hasAnthropicKey ? (
          <div className="flex items-center gap-3">
            <span>sk-ant-...{profile.anthropicKeyLast4}</span>
            <button onClick={onRemoveKey} className="text-sm text-red-600 underline">
              Remove key
            </button>
          </div>
        ) : (
          <form onSubmit={onSaveKey} className="space-y-2">
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="text-sm underline">Save key</button>
          </form>
        )}
        {status.apiKey && <p className="text-sm">{status.apiKey}</p>}
      </div>
    </div>
  );
}
