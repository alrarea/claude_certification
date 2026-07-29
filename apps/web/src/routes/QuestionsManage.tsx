import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { SelectField } from "../components/TextField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ApiKeyPromptModal } from "../components/ApiKeyPromptModal";

type PendingAction =
  | { kind: "upload"; body: { certification: string; filename: string; contentBase64: string } }
  | { kind: "generate"; body: { certification: string; difficulty: string; count: number } };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function QuestionsManage() {
  const [certification, setCertification] = useState("ccaf");
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [genDifficulty, setGenDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [genCount, setGenCount] = useState(5);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // If neither action has a saved key to fall back on, the backend replies
  // with needsApiKey - that's when we remember what the user was trying to
  // do and pop the key prompt, instead of just surfacing a dead-end error.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [keyModalSubmitting, setKeyModalSubmitting] = useState(false);
  const [keyModalError, setKeyModalError] = useState<string | null>(null);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const body = { certification, filename: file.name, contentBase64 };
      try {
        const data = await apiFetch("/questions/upload", { method: "POST", body: JSON.stringify(body) });
        setUploadStatus(`Uploaded — ${data.generatedQuestionCt} question(s) generated (pending review)`);
      } catch (err) {
        if (err instanceof ApiError && err.data?.needsApiKey) {
          setPendingAction({ kind: "upload", body });
        } else {
          setUploadStatus(err instanceof Error ? err.message : "Upload failed");
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setGenStatus(null);
    try {
      const body = { certification, difficulty: genDifficulty, count: genCount };
      const data = await apiFetch("/questions/generate", { method: "POST", body: JSON.stringify(body) });
      setGenStatus(`${data.createdCount} question(s) generated (pending review, usable by you now)`);
    } catch (err) {
      if (err instanceof ApiError && err.data?.needsApiKey) {
        setPendingAction({ kind: "generate", body: { certification, difficulty: genDifficulty, count: genCount } });
      } else {
        setGenStatus(err instanceof Error ? err.message : "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function onKeyModalSubmit(apiKey: string, saveKey: boolean) {
    if (!pendingAction) return;
    setKeyModalSubmitting(true);
    setKeyModalError(null);
    try {
      const path = pendingAction.kind === "upload" ? "/questions/upload" : "/questions/generate";
      const data = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ ...pendingAction.body, apiKey, saveKey }),
      });
      if (pendingAction.kind === "upload") {
        setUploadStatus(`Uploaded — ${data.generatedQuestionCt} question(s) generated (pending review)`);
      } else {
        setGenStatus(`${data.createdCount} question(s) generated (pending review, usable by you now)`);
      }
      setPendingAction(null);
    } catch (err) {
      setKeyModalError(err instanceof Error ? err.message : "That didn't work — try again");
    } finally {
      setKeyModalSubmitting(false);
    }
  }

  return (
    <AppShell maxWidth={560}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Question bank</h1>
      <p className="text-sm" style={{ color: "var(--color-ink-500)", marginBottom: 20 }}>
        Both actions below use Claude and need an Anthropic API key — your saved key is used automatically if you
        have one, otherwise you'll be asked for one at the time.
      </p>

      <div className="field" style={{ marginBottom: 20 }}>
        <SelectField label="Certification" value={certification} onChange={(e) => setCertification(e.target.value)}>
          <option value="ccaf">CCAF</option>
          <option value="ccap">CCAP</option>
        </SelectField>
      </div>

      <form onSubmit={onUpload} className="card flex flex-col gap-3" style={{ padding: 24, marginBottom: 20 }}>
        <label className="field-label">Upload a document (PDF/DOCX/PPTX/MD/HTML) — converted into questions by Claude</label>
        <input
          type="file"
          accept=".pdf,.docx,.html,.pptx,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button size="sm" variant="secondary" loading={uploading}>
          Upload
        </Button>
        {uploadStatus && <Alert kind={uploadStatus.startsWith("Uploaded") ? "success" : "error"}>{uploadStatus}</Alert>}
      </form>

      <form onSubmit={onGenerate} className="card flex flex-col gap-3" style={{ padding: 24 }}>
        <label className="field-label">Generate a fresh set</label>
        <SelectField value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value as typeof genDifficulty)}>
          <option value="mixed">Mixed</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </SelectField>
        <input
          type="number"
          className="input"
          value={genCount}
          onChange={(e) => setGenCount(Number(e.target.value))}
          min={1}
          max={20}
        />
        <Button size="sm" variant="secondary" loading={generating}>
          Generate
        </Button>
        {genStatus && <Alert kind={/^\d+ question/.test(genStatus) ? "success" : "error"}>{genStatus}</Alert>}
      </form>

      {pendingAction && (
        <ApiKeyPromptModal
          actionLabel={pendingAction.kind === "upload" ? "Uploading this document" : "Generating questions"}
          submitting={keyModalSubmitting}
          error={keyModalError}
          onSubmit={onKeyModalSubmit}
          onCancel={() => {
            setPendingAction(null);
            setKeyModalError(null);
          }}
        />
      )}
    </AppShell>
  );
}
