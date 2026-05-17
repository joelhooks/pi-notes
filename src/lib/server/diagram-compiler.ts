import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

export const DIAGRAM_COMPILER_VERSION = "0.1.0";

type NodeSpec = { id: string; label: string; sub?: string; lane?: string; rank?: number };
type EdgeSpec = { from: string; to: string; label?: string };

type DiagramSpec = {
  title: string;
  direction: "LR";
  spacing: "compact" | "relaxed";
  theme: "notes";
  layout: "wide";
  nodes: NodeSpec[];
  edges: EdgeSpec[];
};

export type DiagramMetadata = {
  sourcePath: string;
  sourceHash: string;
  compilerVersion: string;
  generatedAt: string;
  warnings: string[];
};

export type DiagramCompileResult = {
  sourcePath: string;
  artifactPath: string;
  sourceHash: string;
  warnings: string[];
  excalidraw: Record<string, unknown>;
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function id(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function artifactPathForSource(sourcePath: string) {
  return sourcePath.replace(new RegExp(`${extname(sourcePath)}$`), ".excalidraw");
}

function attrs(input: string) {
  const out: Record<string, string> = {};
  for (const match of input.matchAll(/(\w+)\s*:\s*("[^"]*"|[^,\]]+)/g)) {
    out[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
  return out;
}

export function parseDiagramSource(source: string): DiagramSpec {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line !== "{");
  const header = lines.find((line) => line.startsWith("dag "));
  const title = header?.match(/^dag\s+"([^"]+)"/)?.[1] ?? basename("diagram");
  const spec: DiagramSpec = { title, direction: "LR", spacing: "relaxed", theme: "notes", layout: "wide", nodes: [], edges: [] };

  for (const line of lines) {
    if (line === "}") continue;
    const setting = line.match(/^(direction|spacing|theme|layout)\s*:\s*(\w+)/);
    if (setting) {
      (spec as unknown as Record<string, string>)[setting[1]] = setting[2];
      continue;
    }

    const edge = line.match(/^(\w+)\s*->\s*(\w+)(?::\s*(.+))?$/);
    if (edge) {
      spec.edges.push({ from: edge[1], to: edge[2], label: edge[3]?.trim().replace(/^"|"$/g, "") });
      continue;
    }

    const node = line.match(/^(\w+)\s*\[(.+)\]$/);
    if (node) {
      const a = attrs(node[2]);
      spec.nodes.push({ id: node[1], label: a.label ?? node[1], sub: a.sub, lane: a.lane, rank: a.rank ? Number(a.rank) : undefined });
    }
  }

  return spec;
}

function warningsFor(spec: DiagramSpec) {
  const warnings: string[] = [];
  const primary = spec.nodes.filter((node) => !node.lane);
  if (primary.length > 8) warnings.push(`${primary.length} primary nodes. Consider splitting this into smaller DAGs.`);
  for (const node of spec.nodes) {
    if (node.label.length > 24) warnings.push(`${node.id} label is ${node.label.length} chars; target is ~24.`);
    if ((node.sub?.length ?? 0) > 32) warnings.push(`${node.id} subtitle is ${node.sub?.length} chars; target is ~32.`);
  }
  return warnings;
}

function ranks(spec: DiagramSpec) {
  const rank = new Map(spec.nodes.map((node) => [node.id, node.rank ?? 0]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of spec.edges) {
      const next = Math.max(rank.get(edge.to) ?? 0, (rank.get(edge.from) ?? 0) + 1);
      if (next !== rank.get(edge.to)) {
        rank.set(edge.to, next);
        changed = true;
      }
    }
  }
  for (const node of spec.nodes) if (node.rank !== undefined) rank.set(node.id, node.rank);
  return rank;
}

function elementBase(type: string, x: number, y: number, width: number, height: number, key: string) {
  return {
    id: id(key), type, x, y, width, height, angle: 0, strokeColor: "#24292f", backgroundColor: "transparent",
    fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null,
    roundness: type === "rectangle" ? { type: 3 } : null, seed: Number.parseInt(id(`${key}:seed`).slice(0, 6), 16), version: 1,
    versionNonce: Number.parseInt(id(`${key}:nonce`).slice(0, 6), 16), isDeleted: false, boundElements: null,
    updated: 1, link: null, locked: false
  };
}

function text(x: number, y: number, width: number, value: string, size: number, key: string, containerId: string | null = null) {
  return {
    ...elementBase("text", x, y, width, Math.max(24, (value.split("\n").length * size * 1.25)), key),
    strokeColor: "#24292f", backgroundColor: "transparent", roundness: null, text: value, fontSize: size, fontFamily: 5,
    textAlign: "center", verticalAlign: "middle", containerId, originalText: value, lineHeight: 1.25
  };
}

function box(node: NodeSpec, x: number, y: number) {
  const width = 180;
  const height = 86;
  const fill = node.lane ? "#f8f9fa" : "#ffffff";
  const rect = { ...elementBase("rectangle", x, y, width, height, `node:${node.id}`), backgroundColor: fill };
  return [rect, text(x + 12, y + 16, width - 24, `${node.label}${node.sub ? `\n${node.sub}` : ""}`, 17, `node:${node.id}:text`, rect.id)];
}

function anchor(from: { x: number; y: number }, to: { x: number; y: number }) {
  const fromCenter = { x: from.x + 90, y: from.y + 43 };
  const toCenter = { x: to.x + 90, y: to.y + 43 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { start: { x: from.x + 180, y: from.y + 43 }, end: { x: to.x, y: to.y + 43 } }
      : { start: { x: from.x, y: from.y + 43 }, end: { x: to.x + 180, y: to.y + 43 } };
  }
  return dy >= 0
    ? { start: { x: from.x + 90, y: from.y + 86 }, end: { x: to.x + 90, y: to.y } }
    : { start: { x: from.x + 90, y: from.y }, end: { x: to.x + 90, y: to.y + 86 } };
}

function arrow(edge: EdgeSpec, from: { x: number; y: number }, to: { x: number; y: number }) {
  const { start, end } = anchor(from, to);
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;
  const arr = {
    ...elementBase("arrow", x1, y1, x2 - x1, y2 - y1, `edge:${edge.from}->${edge.to}`),
    strokeColor: "#4b5563", strokeWidth: 2, roundness: { type: 2 }, points: [[0, 0], [x2 - x1, y2 - y1]],
    lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow"
  };
  const out: unknown[] = [arr];
  if (edge.label) out.push(text(x2 - 72, y2 - 30, 64, edge.label, 13, `edge:${edge.from}->${edge.to}:label`));
  return out;
}

export function compileDiagramSource(sourcePath: string, source: string): DiagramCompileResult {
  const spec = parseDiagramSource(source);
  const warnings = warningsFor(spec);
  const sourceHash = hash(source);
  const rank = ranks(spec);
  const primary = spec.nodes.filter((node) => !node.lane);
  const lane = spec.nodes.filter((node) => node.lane);
  const byRank = new Map<number, NodeSpec[]>();
  for (const node of primary) {
    const r = rank.get(node.id) ?? 0;
    byRank.set(r, [...(byRank.get(r) ?? []), node]);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const startX = 60;
  const startY = 150;
  const gapX = spec.spacing === "compact" ? 210 : 240;
  const gapY = 120;
  for (const [r, nodes] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    nodes.forEach((node, index) => positions.set(node.id, { x: startX + r * gapX, y: startY + index * gapY }));
  }
  const maxRank = Math.max(0, ...[...rank.values()]);
  lane.forEach((node, index) => positions.set(node.id, { x: startX + (maxRank - lane.length + 1 + index) * gapX, y: startY + 190 }));

  const elements: unknown[] = [text(60, 40, 720, spec.title, 28, "title")];
  for (const node of spec.nodes) elements.push(...box(node, positions.get(node.id)?.x ?? startX, positions.get(node.id)?.y ?? startY));
  for (const edge of spec.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) {
      warnings.push(`Edge ${edge.from} -> ${edge.to} references an unknown node.`);
      continue;
    }
    elements.push(...arrow(edge, from, to));
  }

  const metadata: DiagramMetadata = { sourcePath, sourceHash, compilerVersion: DIAGRAM_COMPILER_VERSION, generatedAt: new Date().toISOString(), warnings };
  return {
    sourcePath,
    artifactPath: artifactPathForSource(sourcePath),
    sourceHash,
    warnings,
    excalidraw: {
      type: "excalidraw", version: 2, source: "https://excalidraw.com", elements,
      appState: { viewBackgroundColor: "#f7f7f5", gridSize: 20, piNotesDiagram: metadata }, files: {}
    }
  };
}

export function compileDiagramFile(root: string, sourcePath: string) {
  const fullPath = resolve(root, sourcePath);
  if (!fullPath.startsWith(resolve(root))) throw new Error(`Diagram source outside root: ${sourcePath}`);
  return compileDiagramSource(sourcePath, readFileSync(fullPath, "utf8"));
}

export function artifactStatus(root: string, sourcePath: string) {
  const fullSource = resolve(root, sourcePath);
  const artifactPath = artifactPathForSource(sourcePath);
  const fullArtifact = resolve(root, artifactPath);
  if (!existsSync(fullSource)) return { status: "missing_source" as const, artifactPath, command: `pi-notes diagram compile ${sourcePath}` };
  if (!existsSync(fullArtifact)) return { status: "missing_artifact" as const, artifactPath, command: `pi-notes diagram compile ${sourcePath}` };
  const sourceHash = hash(readFileSync(fullSource, "utf8"));
  try {
    const artifact = JSON.parse(readFileSync(fullArtifact, "utf8")) as { appState?: { piNotesDiagram?: DiagramMetadata } };
    const metadata = artifact.appState?.piNotesDiagram;
    if (metadata?.sourceHash !== sourceHash) return { status: "stale" as const, artifactPath, command: `pi-notes diagram compile ${sourcePath}`, metadata };
    return { status: "fresh" as const, artifactPath, command: `pi-notes diagram compile ${sourcePath}`, metadata };
  } catch {
    return { status: "invalid_artifact" as const, artifactPath, command: `pi-notes diagram compile ${sourcePath}` };
  }
}
