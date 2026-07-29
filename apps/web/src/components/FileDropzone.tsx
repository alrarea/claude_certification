import { useRef, useState, type DragEvent } from "react";

interface FileDropzoneProps {
  accept: string;
  file: File | null;
  onFileSelected: (file: File | null) => void;
}

// Tailwind's preflight resets input[type=file] with appearance:none, which
// strips the native "Choose File" button and filename text entirely in most
// browsers - leaving a blank, unclickable-looking box with zero feedback
// once a file is picked. This wraps a visually-hidden real file input (so
// the OS's native picker still opens) in a properly styled, clickable area
// that shows the selected filename and also accepts drag-and-drop.
export function FileDropzone({ accept, file, onFileSelected }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptedExtensions = accept.split(",").map((e) => e.trim().toLowerCase());

  function isAccepted(filename: string): boolean {
    const lower = filename.toLowerCase();
    return acceptedExtensions.some((ext) => lower.endsWith(ext));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && isAccepted(dropped.name)) {
      onFileSelected(dropped);
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${isDragOver ? "var(--color-clay)" : "var(--color-border-strong)"}`,
          borderRadius: "var(--radius-md)",
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragOver ? "var(--color-cream-100)" : "transparent",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        {file ? (
          <p className="text-sm" style={{ color: "var(--color-ink)" }}>
            {file.name} <span style={{ color: "var(--color-ink-500)" }}>— click or drop to replace</span>
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-ink-500)" }}>
            Click to browse, or drag a file here
          </p>
        )}
      </div>
    </div>
  );
}
