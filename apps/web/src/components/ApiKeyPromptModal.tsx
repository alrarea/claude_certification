import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { Alert } from "./Alert";

interface ApiKeyPromptModalProps {
  actionLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (apiKey: string, saveKey: boolean) => void;
  onCancel: () => void;
}

export function ApiKeyPromptModal({ actionLabel, submitting, error, onSubmit, onCancel }: ApiKeyPromptModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [saveKey, setSaveKey] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    onSubmit(apiKey.trim(), saveKey);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 20, 19, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 440, width: "100%", padding: 32 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, marginBottom: 8 }}>Anthropic API key needed</h2>
        <p className="text-sm" style={{ color: "var(--color-ink-500)", marginBottom: 20 }}>
          {actionLabel} uses Claude to do the work. Enter an Anthropic API key to use for this action — it's only
          used once and isn't saved unless you check the box below.
        </p>
        <TextField
          label="Anthropic API key"
          placeholder="sk-ant-..."
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoFocus
        />
        <label className="flex items-center gap-2 text-sm" style={{ marginTop: 12, marginBottom: 20, cursor: "pointer" }}>
          <input type="checkbox" checked={saveKey} onChange={(e) => setSaveKey(e.target.checked)} />
          Save this key to my profile for future use
        </label>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="clay" loading={submitting} disabled={!apiKey.trim()}>
            Continue
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
