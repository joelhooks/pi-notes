import { createHash } from "node:crypto";

// @ts-check

/**
 * Bump when the rendering harness or tldraw export behavior changes. The hash
 * stays source-only so URLs remain stable; this marker tells the renderer when
 * to refresh the SVG body in place.
 */
export const RENDER_VERSION = "tldraw-mermaid-5.1.1-r1";

export function renderMarker(version = RENDER_VERSION) {
  return `<!-- pi-notes mermaid render:${version} -->`;
}

export const DIAGRAM_DIR = "diagrams";
export const DIAGRAM_PUBLIC_PREFIX = `/${DIAGRAM_DIR}`;

/** Workspace-local cache for generated SVGs. SvelteKit serves this through
 * src/routes/diagrams/[file]/+server.ts instead of writing into package static.
 */
export const DIAGRAM_CACHE_DIR = [".pi", "notes-cache", "diagrams"];

/** @param {string} source */
export function hashMermaid(source) {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * @param {string | null | undefined} meta
 * @returns {Record<string, string>}
 */
export function parseMermaidMeta(meta) {
  const out = /** @type {Record<string, string>} */ ({});
  for (const match of (meta ?? "").matchAll(/(\w+)=("[^"]*"|'[^']*'|\S+)/g)) {
    const key = match[1];
    const value = match[2];
    if (!key || !value) continue;
    out[key] = value.replace(/^["']|["']$/g, "");
  }
  return out;
}

/** @param {string | null | undefined} value */
export function toCssLength(value) {
  if (!value) return null;
  return /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
}

/**
 * @param {string} source
 * @param {string | null | undefined} [meta]
 */
export function renderMermaidFigure(source, meta) {
  const hash = hashMermaid(source);
  const opts = parseMermaidMeta(meta);
  const maxWidth = toCssLength(opts.width);
  const style = maxWidth ? ` style="max-width:${maxWidth}"` : "";
  /** @param {"light" | "dark"} variant @param {string} suffix */
  const img = (variant, suffix) =>
    `<img class="mermaid-${variant}" src="${DIAGRAM_PUBLIC_PREFIX}/${hash}${suffix}.svg" alt="Diagram" loading="lazy" decoding="async" />`;

  return `<figure class="mermaid-diagram not-prose"${style}>${img("light", "")}${img("dark", ".dark")}</figure>`;
}

/** Extract fenced ```mermaid blocks without requiring full MDX parsing. */
/** @param {string} markdown */
export function extractMermaidBlocks(markdown) {
  const blocks = /** @type {string[]} */ ([]);
  const fence = /(^|\n)(`{3,}|~{3,})\s*mermaid\b[^\n]*\n([\s\S]*?)\n\2(?=\n|$)/g;
  for (const match of markdown.matchAll(fence)) {
    const source = match[3]?.trim();
    if (source) blocks.push(source);
  }
  return blocks;
}
