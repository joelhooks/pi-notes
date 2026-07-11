#!/usr/bin/env bun
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import {
  DIAGRAM_CACHE_DIR,
  extractMermaidBlocks,
  hashMermaid,
  renderMarker,
} from "../src/lib/server/mermaid/shared.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const harnessRoot = path.join(here, "mermaid");
const RENDER_OPTS = { padding: 16 };

type Diagram = {
  hash: string;
  source: string;
  sourcePath: string;
};

export type RenderSummary = {
  total: number;
  rendered: number;
};

type RenderDiagramsOptions = {
  root?: string;
};

function workspaceRoot(root?: string) {
  return path.resolve(root ?? process.env.PI_NOTES_WORKSPACE_ROOT ?? process.cwd());
}

function outputDir(root: string) {
  return path.join(root, ...DIAGRAM_CACHE_DIR);
}

async function exists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walkReviewMarkdown(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkReviewMarkdown(full);
      if (!entry.isFile()) return [];
      return /\.(svx|mdx?|svelte\.md)$/.test(entry.name) ? [full] : [];
    }),
  );
  return files.flat();
}

async function collectSourceFiles(root: string) {
  const roots = [path.join(root, ".brain"), path.join(root, "docs")];
  const files = await Promise.all(roots.map(walkReviewMarkdown));
  return files.flat().sort((a, b) => a.localeCompare(b));
}

async function collectDiagrams(root: string): Promise<Diagram[]> {
  const files = await collectSourceFiles(root);
  const diagrams: Diagram[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const markdown = await fs.readFile(file, "utf8");
    for (const source of extractMermaidBlocks(markdown)) {
      const hash = hashMermaid(source);
      if (seen.has(hash)) continue;
      seen.add(hash);
      diagrams.push({ hash, source, sourcePath: path.relative(root, file) });
    }
  }
  return diagrams;
}

function variantPaths(root: string, hash: string): { light: string; dark: string } {
  const outDir = outputDir(root);
  return {
    light: path.join(outDir, `${hash}.svg`),
    dark: path.join(outDir, `${hash}.dark.svg`),
  };
}

async function hasMarker(file: string): Promise<boolean> {
  try {
    return (await fs.readFile(file, "utf8")).includes(renderMarker());
  } catch {
    return false;
  }
}

async function isUpToDate(root: string, hash: string): Promise<boolean> {
  const { light, dark } = variantPaths(root, hash);
  return (await hasMarker(light)) && (await hasMarker(dark));
}

async function pruneOrphans(root: string, keep: Set<string>): Promise<void> {
  const outDir = outputDir(root);
  if (!(await exists(outDir))) return;
  const files = await fs.readdir(outDir);
  for (const name of files) {
    if (!name.endsWith(".svg")) continue;
    const hash = name.replace(/\.dark\.svg$/, "").replace(/\.svg$/, "");
    if (keep.has(hash)) continue;
    await fs.rm(path.join(outDir, name));
    console.log(`[mermaid] pruned orphan ${name}`);
  }
}

async function renderPending(root: string, pending: Diagram[]): Promise<void> {
  let server: ViteDevServer | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    server = await createServer({
      root: harnessRoot,
      configFile: false,
      plugins: [react()],
      logLevel: "warn",
      server: { host: "127.0.0.1" },
      optimizeDeps: { include: ["@tldraw/mermaid", "react", "react-dom/client", "tldraw"] },
    });
    await server.listen();
    const base = server.resolvedUrls?.local[0];
    if (!base) throw new Error("vite did not report a local harness url");

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    page.on("pageerror", (error) => console.error("[mermaid harness pageerror]", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.error("[mermaid harness console]", message.text());
    });

    await page.goto(new URL("harness.html", base).href);
    await page.waitForFunction(() => Boolean((window as unknown as { __tldrawEditor?: unknown }).__tldrawEditor), { timeout: 30_000 });

    for (const diagram of pending) {
      const result = await page.evaluate(
        ({ source, opts }) =>
          (
            window as unknown as {
              renderMermaid: (input: string, options: typeof opts) => Promise<{ light: string; dark: string }>;
            }
          ).renderMermaid(source, opts),
        { source: diagram.source, opts: RENDER_OPTS },
      );
      const { light, dark } = variantPaths(root, diagram.hash);
      await fs.writeFile(light, `${renderMarker()}\n${result.light}`, "utf8");
      await fs.writeFile(dark, `${renderMarker()}\n${result.dark}`, "utf8");
      console.log(`[mermaid] rendered ${diagram.hash}.svg (+dark) (${diagram.sourcePath})`);
    }
  } finally {
    await browser?.close();
    await server?.close();
  }
}

export async function renderDiagrams(options: RenderDiagramsOptions = {}): Promise<RenderSummary> {
  const root = workspaceRoot(options.root);
  const diagrams = await collectDiagrams(root);
  if (!diagrams.length) return { total: 0, rendered: 0 };

  await fs.mkdir(outputDir(root), { recursive: true });

  const pending: Diagram[] = [];
  for (const diagram of diagrams) {
    if (await isUpToDate(root, diagram.hash)) continue;
    pending.push(diagram);
  }

  if (pending.length) {
    console.log(`[mermaid] rendering ${pending.length} of ${diagrams.length} diagram(s)...`);
    await renderPending(root, pending);
  }

  return { total: diagrams.length, rendered: pending.length };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const clean = args.includes("--clean");
  const rootArg = args.find((arg) => !arg.startsWith("--"));
  const root = workspaceRoot(rootArg);

  if (clean) {
    const diagrams = await collectDiagrams(root);
    await pruneOrphans(root, new Set(diagrams.map((diagram) => diagram.hash)));
  }

  const { total, rendered } = await renderDiagrams({ root });
  if (!total) console.log("[mermaid] no mermaid diagrams found");
  else if (!rendered) console.log(`[mermaid] ${total} diagram(s) already cached, nothing to render`);
  else console.log("[mermaid] done");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error("[mermaid] render failed:", error);
    console.error("[mermaid] If this is a fresh machine, run `bunx playwright install chromium` once.");
    process.exit(1);
  });
}
