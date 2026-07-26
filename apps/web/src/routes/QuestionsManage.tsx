import { useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";
import { AppShell } from "../components/AppShell";
import { SelectField } from "../components/TextField";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

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

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const data = await apiFetch("/questions/upload", {
        method: "POST",
        body: JSON.stringify({ certification, filename: file.name, contentBase64 }),
      });
      setUploadStatus(`Uploaded — ${data.generatedQuestionCt} question(s) generated (pending review)`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setGenStatus(null);
    try {
      const data = await apiFetch("/questions/generate", {
        method: "POST",
        body: JSON.stringify({ certification, difficulty: genDifficulty, count: genCount }),
      });
      setGenStatus(`${data.createdCount} question(s) generated (pending review, usable by you now)`);
    } catch (err) {
      setGenStatus(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell maxWidth={560}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Question bank</h1>

      <div className="field" style={{ marginBottom: 20 }}>
        <SelectField label="Certification" value={certification} onChange={(e) => setCertification(e.target.value)}>
          <option value="ccaf">CCAF</option>
          <option value="ccap">CCAP</option>
        </SelectField>
      </div>

      <form onSubmit={onUpload} className="card flex flex-col gap-3" style={{ padding: 24, marginBottom: 20 }}>
        <label className="field-label">Upload a document (PDF/DOCX/HTML)</label>
        <input type="file" accept=".pdf,.docx,.html" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <Button size="sm" variant="secondary" loading={uploading}>
          Upload
        </Button>
        {uploadStatus && <Alert kind={uploadStatus.startsWith("Uploaded") ? "success" : "error"}>{uploadStatus}</Alert>}
      </form>

      <form onSubmit={onGenerate} className="card flex flex-col gap-3" style={{ padding: 24 }}>
        <label className="field-label">Generate a fresh set (requires your saved API key)</label>
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
    </AppShell>
  );
}
