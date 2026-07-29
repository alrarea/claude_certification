import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid";

function flattenText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (node && typeof node === "object" && "props" in (node as any)) {
    return flattenText((node as any).props.children);
  }
  return "";
}

function findFirstStrongText(node: ReactNode): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstStrongText(child);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object" && "type" in (node as any)) {
    const el = node as any;
    if (el.type === "strong") return flattenText(el.props.children);
    return findFirstStrongText(el.props?.children);
  }
  return null;
}

function calloutVariant(label: string): string {
  const t = label.toLowerCase();
  if (t.includes("tip")) return "tip";
  if (t.includes("watch out") || t.includes("warning") || t.includes("caution")) return "warn";
  if (t.includes("key takeaway") || t.includes("key point") || t.includes("the rule")) return "key";
  if (t.includes("exam focus") || t.includes("exam tip") || t.includes("exam ")) return "exam";
  if (t.includes("plain english") || t.includes("plain language")) return "plain";
  if (t.includes("real-world") || t.includes("real world")) return "real";
  if (t.includes("out of scope") || t.includes("not on the exam")) return "oos";
  return "default";
}

function Blockquote({ children, ...rest }: { children?: ReactNode }) {
  const label = findFirstStrongText(children);
  const variant = label ? calloutVariant(label) : "default";
  return (
    <blockquote className={variant !== "default" ? `callout-${variant}` : ""} {...rest}>
      {children}
    </blockquote>
  );
}

// Fenced ```mermaid blocks render as diagrams instead of literal code -
// react-markdown always wraps a fenced block as <pre><code className="language-x">,
// so `code` renders the Mermaid component in place of <code>, and `pre` unwraps
// its own tag for that one case (mermaid renders its own container, not <pre>).
function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  if (className?.includes("language-mermaid")) {
    return <Mermaid chart={flattenText(children).replace(/\n$/, "")} />;
  }
  return <code className={className}>{children}</code>;
}

function Pre({ children }: { children?: ReactNode }) {
  const child = Array.isArray(children) ? children[0] : children;
  const childClassName = child && typeof child === "object" && "props" in (child as any) ? (child as any).props?.className : undefined;
  if (typeof childClassName === "string" && childClassName.includes("language-mermaid")) {
    return <>{children}</>;
  }
  return <pre>{children}</pre>;
}

export function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ blockquote: Blockquote, code: CodeBlock, pre: Pre }}>
      {children}
    </ReactMarkdown>
  );
}
