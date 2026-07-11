import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { codeToHtml } from "shiki";
import { artifactStatus } from "./diagram-compiler";
import { renderMermaidFigure } from "./mermaid/shared.js";

export type ReviewBlock = {
  id: string;
  kind: "heading" | "paragraph" | "list" | "code";
  text: string;
  html: string;
  hash: string;
};

export type BrainProjectStatus = "active" | "queued" | "blocked" | "paused" | "done" | "archived";

export type ReviewDocument = {
  id: string;
  title: string;
  sourcePath: string;
  hash: string;
  para: "Projects" | "Areas" | "Resources" | "Archives";
  status?: BrainProjectStatus;
  blocks: ReviewBlock[];
};

export type BrainEntry = {
  id: string;
  title: string;
  sourcePath: string;
  hash: string;
  blockCount: number;
  para: ReviewDocument["para"];
  status?: BrainProjectStatus;
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function titleFromMarkdown(source: string, fallback: string) {
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function frontmatter(source: string) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {} as Record<string, string>;
  return Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.match(/^(\w+):\s*(.+)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].trim().replace(/^"|"$/g, "")]),
  );
}

function projectStatus(source: string, para: ReviewDocument["para"]): BrainProjectStatus | undefined {
  if (para !== "Projects") return undefined;
  const raw = frontmatter(source).status;
  if (["active", "queued", "blocked", "paused", "done", "archived"].includes(raw)) return raw as BrainProjectStatus;
  return "active";
}

function blockKind(block: string): ReviewBlock["kind"] {
  if (block.startsWith("```")) return "code";
  if (block.startsWith("#")) return "heading";
  if (/^\s*[-*]\s+/m.test(block) || /^\s*\d+\.\s+/m.test(block)) return "list";
  return "paragraph";
}

function codeFence(block: string) {
  const match = block.match(/^```([^\n]*)\n?([\s\S]*?)\n?```$/);
  const info = match?.[1]?.trim() ?? "";
  const [lang = "text", ...metaParts] = info.split(/\s+/).filter(Boolean);
  return {
    lang,
    meta: metaParts.join(" "),
    code: match?.[2] ?? block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, ""),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[([^\]]+)\]\]/g, '<a href="#brain-$1">$1</a>');
}

function renderDiagramSourcePreview(root: string, sourcePath: string) {
  const status = artifactStatus(root, sourcePath);
  if (status.status !== "fresh") {
    return `<figure class="excalidraw-preview"><figcaption>${escapeHtml(sourcePath)}</figcaption><div class="diagram-warning">Diagram artifact is ${escapeHtml(status.status.replaceAll("_", " "))}. Run <code>${escapeHtml(status.command)}</code></div></figure>`;
  }
  return renderExcalidrawPreview(root, status.artifactPath, status.metadata?.warnings ?? []);
}

function renderExcalidrawPreview(root: string, diagramPath: string, warnings: string[] = []) {
  const fullPath = resolve(root, diagramPath);
  if (!fullPath.startsWith(resolve(root)) || !existsSync(fullPath)) return undefined;

  try {
    const data = JSON.parse(readFileSync(fullPath, "utf8")) as { elements?: Array<Record<string, unknown>>; appState?: { piNotesDiagram?: { warnings?: string[] } } };
    const elements = (data.elements ?? []).filter((element) => !element.isDeleted);
    const drawable = elements.filter((element) => ["rectangle", "ellipse", "diamond", "text", "arrow"].includes(String(element.type)));
    if (drawable.length === 0) return undefined;

    const xs = drawable.flatMap((element) => {
      const x = Number(element.x ?? 0);
      const width = Number(element.width ?? 0);
      return [x, x + width];
    });
    const ys = drawable.flatMap((element) => {
      const y = Number(element.y ?? 0);
      const height = Number(element.height ?? 0);
      return [y, y + height];
    });
    const minX = Math.min(...xs) - 24;
    const minY = Math.min(...ys) - 24;
    const width = Math.max(...xs) - minX + 24;
    const height = Math.max(...ys) - minY + 24;

    const rendered = drawable.map((element) => {
      const type = String(element.type);
      const x = Number(element.x ?? 0) - minX;
      const y = Number(element.y ?? 0) - minY;
      const w = Number(element.width ?? 0);
      const h = Number(element.height ?? 0);
      const stroke = escapeHtml(String(element.strokeColor ?? "#24292f"));
      const fill = escapeHtml(String(element.backgroundColor ?? "transparent"));
      const text = escapeHtml(String(element.text ?? ""));

      if (type === "text" && text) {
        return `<div class="excalidraw-text" style="left:${x}px;top:${y}px;width:${Math.max(w, 80)}px;font-size:${Number(element.fontSize ?? 16)}px;">${text.replaceAll("\n", "<br>")}</div>`;
      }
      if (type === "arrow") {
        const points = (element.points as number[][] | undefined) ?? [[0, 0], [w, h]];
        const end = points.at(-1) ?? [w, h];
        return `<svg class="excalidraw-arrow" style="left:${Math.min(0, end[0]) + x}px;top:${Math.min(0, end[1]) + y}px;width:${Math.abs(end[0]) + 24}px;height:${Math.abs(end[1]) + 24}px;" viewBox="0 0 ${Math.abs(end[0]) + 24} ${Math.abs(end[1]) + 24}" aria-hidden="true"><defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${stroke}" /></marker></defs><line x1="${end[0] < 0 ? Math.abs(end[0]) + 12 : 12}" y1="${end[1] < 0 ? Math.abs(end[1]) + 12 : 12}" x2="${end[0] < 0 ? 12 : Math.abs(end[0]) + 12}" y2="${end[1] < 0 ? 12 : Math.abs(end[1]) + 12}" stroke="${stroke}" stroke-width="2" marker-end="url(#arrowhead)" /></svg>`;
      }
      if (type === "ellipse") return `<div class="excalidraw-shape ellipse" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${stroke};background:${fill};"></div>`;
      if (type === "diamond") return `<div class="excalidraw-shape diamond" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${stroke};background:${fill};"></div>`;
      return `<div class="excalidraw-shape" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${stroke};background:${fill};"></div>`;
    }).join("");

    const allWarnings = [...warnings, ...(data.appState?.piNotesDiagram?.warnings ?? [])];
    const footer = allWarnings.length > 0 ? `<footer class="diagram-warning">${allWarnings.map((warning) => escapeHtml(warning)).join("<br>")}</footer>` : "";
    return `<figure class="excalidraw-preview"><figcaption>${escapeHtml(diagramPath)}</figcaption><div class="excalidraw-viewport" style="aspect-ratio:${width}/${height};"><div class="excalidraw-canvas" style="width:${width}px;height:${height}px;--diagram-width:${width};--diagram-height:${height};">${rendered}</div></div>${footer}</figure>`;
  } catch {
    return undefined;
  }
}

async function renderBlock(root: string, block: string, kind: ReviewBlock["kind"]) {
  if (kind === "code") {
    const { code, lang, meta } = codeFence(block);
    if (lang === "mermaid") return renderMermaidFigure(code, meta);
    const trimmedCode = code.trim();
    const isSinglePath = !trimmedCode.includes("\n") && !trimmedCode.includes(" ") && !trimmedCode.includes("*");
    const sourceExists = isSinglePath && existsSync(resolve(root, trimmedCode));
    const diagram = sourceExists && trimmedCode.endsWith(".diagram") ? renderDiagramSourcePreview(root, trimmedCode) : sourceExists && trimmedCode.endsWith(".excalidraw") ? renderExcalidrawPreview(root, trimmedCode) : undefined;
    if (diagram) return diagram;
    return codeToHtml(code, { lang, theme: "catppuccin-mocha" });
  }

  if (kind === "heading") {
    const match = block.match(/^(#{1,6})\s+(.+)$/);
    const level = Math.min(match?.[1]?.length ?? 2, 3);
    return `<h${level}>${renderInline(match?.[2] ?? block.replace(/^#+\s*/, ""))}</h${level}>`;
  }

  if (kind === "list") {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const ordered = lines.every((line) => /^\d+\.\s+/.test(line));
    const tag = ordered ? "ol" : "ul";
    const items = lines
      .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
      .map((line) => `<li>${renderInline(line)}</li>`)
      .join("");
    return `<${tag}>${items}</${tag}>`;
  }

  return `<p>${renderInline(block)}</p>`;
}

function splitReviewBlocks(source: string) {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of source.split("\n")) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      current.push(line);
      if (!inFence) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      continue;
    }

    if (!inFence && line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) blocks.push(current.join("\n").trim());
  return blocks.filter(Boolean);
}

async function parseBlocks(root: string, docId: string, source: string): Promise<ReviewBlock[]> {
  return Promise.all(splitReviewBlocks(source).map(async (block, index) => {
    const kind = blockKind(block);
    return {
      id: `${docId}.block-${index + 1}`,
      kind,
      text: block,
      html: await renderBlock(root, block, kind),
      hash: hash(block),
    };
  }));
}

function paraFromFile(file: string): ReviewDocument["para"] {
  if (file === "index.svx") return "Resources";
  const [first] = file.split(/[\\/]/);
  if (first === "areas") return "Areas";
  if (first === "resources") return "Resources";
  if (first === "archives") return "Archives";
  return "Projects";
}

function listBrainFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      const relative = prefix ? join(prefix, entry) : entry;
      if (statSync(path).isDirectory()) return listBrainFiles(path, relative);
      return entry.endsWith(".svx") ? [relative] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

async function loadBrainReviewDocumentFromFile(root: string, file: string): Promise<ReviewDocument> {
  const sourcePath = join(".brain", file);
  const fullPath = join(root, sourcePath);
  const source = readFileSync(fullPath, "utf8");
  const id = file.replace(/\.svx$/, "");
  const para = paraFromFile(file);
  return {
    id,
    title: titleFromMarkdown(source, id),
    sourcePath,
    hash: hash(source),
    para,
    status: projectStatus(source, para),
    blocks: await parseBlocks(root, id, source),
  };
}

export function listBrainEntries(root: string): BrainEntry[] {
  const brainDir = join(root, ".brain");

  return listBrainFiles(brainDir).map((file) => {
    const sourcePath = join(".brain", file);
    const source = readFileSync(join(root, sourcePath), "utf8");
    const id = file.replace(/\.svx$/, "");
    return {
      id,
      title: titleFromMarkdown(source, id),
      sourcePath,
      hash: hash(source),
      blockCount: splitReviewBlocks(source).length,
      para: paraFromFile(file),
      status: projectStatus(source, paraFromFile(file)),
    };
  });
}

export async function loadBrainReviewDocument(root: string, entry: string): Promise<ReviewDocument | undefined> {
  const brainDir = join(root, ".brain");
  const file = `${entry}.svx`;
  const fullPath = join(brainDir, file);
  if (!existsSync(fullPath)) return undefined;
  return loadBrainReviewDocumentFromFile(root, file);
}

export async function loadBrainReviewDocuments(root: string): Promise<ReviewDocument[]> {
  const brainDir = join(root, ".brain");
  if (!existsSync(brainDir)) return [];

  return Promise.all(listBrainFiles(brainDir).map((file) => loadBrainReviewDocumentFromFile(root, file)));
}
