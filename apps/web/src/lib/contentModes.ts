export type ContentMode = "in_depth" | "normal" | "concise";

export const MODE_LABELS: Record<ContentMode, string> = {
  in_depth: "In-depth",
  normal: "Normal",
  concise: "Concise",
};

export const CONTENT_MODES = Object.keys(MODE_LABELS) as ContentMode[];
