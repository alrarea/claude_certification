import { useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";

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

  const [genDifficulty, setGenDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [genCount, setGenCount] = useState(5);
  const [genStatus, setGenStatus] = useState<string | null>(null);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploadStatus("Uploading...");
    try {
      const contentBase64 = await fileToBase64(file);
      const data = await apiFetch("/questions/upload", {
        method: "POST",
        body: JSON.stringify({ certification, filename: file.name, contentBase64 }),
      });
      setUploadStatus(`Uploaded - ${data.generatedQuestionCt} question(s) generated (pending review)`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setGenStatus("Generating...");
    try {
      const data = await apiFetch("/questions/generate", {
        method: "POST",
        body: JSON.stringify({ certification, difficulty: genDifficulty, count: genCount }),
      });
      setGenStatus(`${data.createdCount} question(s) generated (pending review, usable by you now)`);
    } catch (err) {
      setGenStatus(err instanceof Error ? err.message : "Generation failed");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 space-y-8">
      <h1 className="text-xl font-semibold">Question bank</h1>

      <select
        className="w-full border rounded px-3 py-2"
        value={certification}
        onChange={(e) => setCertification(e.target.value)}
      >
        <option value="ccaf">CCAF</option>
        <option value="ccap">CCAP</option>
      </select>

      <form onSubmit={onUpload} className="space-y-2">
        <label className="block text-sm text-gray-600">Upload a document (PDF/DOCX/HTML)</label>
        <input
          type="file"
          accept=".pdf,.docx,.html"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button className="text-sm underline">Upload</button>
        {uploadStatus && <p className="text-sm">{uploadStatus}</p>}
      </form>

      <form onSubmit={onGenerate} className="space-y-2">
        <label className="block text-sm text-gray-600">Generate a fresh set (requires your saved API key)</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={genDifficulty}
          onChange={(e) => setGenDifficulty(e.target.value as typeof genDifficulty)}
        >
          <option value="mixed">Mixed</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <input
          type="number"
          className="w-full border rounded px-3 py-2"
          value={genCount}
          onChange={(e) => setGenCount(Number(e.target.value))}
          min={1}
          max={20}
        />
        <button className="text-sm underline">Generate</button>
        {genStatus && <p className="text-sm">{genStatus}</p>}
      </form>
    </div>
  );
}
