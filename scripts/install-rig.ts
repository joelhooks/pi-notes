#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const targetArg = process.argv[2];
if (!targetArg) {
  console.error("Usage: bun run rig:install -- <target-repo>");
  process.exit(1);
}

const targetRoot = resolve(process.cwd(), targetArg);
const projectSlug = basename(targetRoot);
const projectTitle = projectSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function readMaybe(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function writeIfMissing(path: string, content: string) {
  if (existsSync(path)) return { path, action: "exists" as const };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  return { path, action: "created" as const };
}

function appendBlock(path: string, marker: string, block: string) {
  const current = readMaybe(path);
  if (!current) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${block.trim()}\n`, "utf8");
    return { path, action: "created" as const };
  }
  if (current.includes(marker)) return { path, action: "exists" as const };
  writeFileSync(path, `${current.trimEnd()}\n\n${block.trim()}\n`, "utf8");
  return { path, action: "updated" as const };
}

function updatePackageScripts(path: string) {
  const current = readMaybe(path);
  if (!current) return { path, action: "missing" as const };
  const pkg = JSON.parse(current);
  pkg.scripts = pkg.scripts ?? {};
  const before = JSON.stringify(pkg.scripts);
  pkg.scripts["brain:check"] = pkg.scripts["brain:check"] ?? "bun scripts/check-brain.ts";
  const after = JSON.stringify(pkg.scripts);
  if (before === after) return { path, action: "exists" as const };
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return { path, action: "updated" as const };
}

const appendSystemBlock = `<!-- pi-notes-rig:start -->
# pi-notes self-documenting rig

This project uses the pi-notes Brain rig for durable agent work capture.

- Use \`.brain/\` as the durable knowledge graph.
- Author Brain pages as \`.svx\` only.
- Keep source-grounded concepts in focused topic files, not loose chat memory.
- Use \`ID.md\` and \`TOOLS.md\` as injected project identity and operating tools context.
- Use \`.pi/extensions/gremlin/index.ts\` for capture helpers when loaded by Pi.
- Run \`bun run brain:check\` after editing the graph.

When this project uses local review pages, treat pi-notes as the substrate: Document Host, Document Adapter, Review Surface, Session Bridge, Review Batch, and Event Stream.
<!-- pi-notes-rig:end -->`;

const id = `# ${projectTitle} identity

This repo uses the pi-notes Brain rig.

## Operating posture

- Preserve project-specific context.
- Capture durable concepts, decisions, gotchas, risks, and next steps in \`.brain/*.svx\`.
- Do not let chat history become the only source of truth.
`;

const tools = `# ${projectTitle} tools

Project-local operating tools and conventions.

## Brain graph

\`.brain/\` is the durable project graph. Author pages as \`.svx\`.

Useful commands:

\`\`\`bash
bun run brain:check
\`\`\`

## pi-notes rig

The gremlin extension injects \`ID.md\` and \`TOOLS.md\`, exposes \`/phase\`, and provides capture/check tools when Pi loads project-local extensions.
`;

const index = `# ${projectTitle} Brain

Self-documenting project graph installed by pi-notes.

## Core

- [[concepts]] — vocabulary and concept inventory
- [[architecture]] — system shape and runtime boundaries
- [[build-process]] — durable build process notes and validation receipts
- [[review]] — current review findings, risks, and next decisions

## Working rule

Do not keep the transcript as the artifact. Capture durable knowledge in the focused topic where it belongs.
`;

const concepts = `# Concepts

Canonical vocabulary for ${projectTitle}.

## Project

${projectTitle} is the current project context for this repository.

## Self-Documenting Rig

The project-local capture system that injects identity/tooling context and stores durable knowledge in \`.brain/*.svx\`.
`;

const architecture = `# Architecture

System shape and runtime boundaries for ${projectTitle}.

## Shape

Capture the project architecture here as it becomes clear.

## Runtime boundaries

List durable process, data, UI, and agent boundaries here.
`;

const buildProcess = `# Build Process

Durable build/setup knowledge and validation receipts for ${projectTitle}.

## Rig bootstrap

Installed the pi-notes Brain rig. Use \`bun run brain:check\` after graph edits.
`;

const review = `# Review

Current findings, risks, and next decisions for ${projectTitle}.

## Current assessment

This graph is newly bootstrapped. Replace this section with grounded findings from the repo.
`;

const results = [
  appendBlock(join(targetRoot, ".pi", "APPEND_SYSTEM.md"), "<!-- pi-notes-rig:start -->", appendSystemBlock),
  writeIfMissing(join(targetRoot, "ID.md"), id),
  writeIfMissing(join(targetRoot, "TOOLS.md"), tools),
  writeIfMissing(join(targetRoot, ".brain", "index.svx"), index),
  writeIfMissing(join(targetRoot, ".brain", "concepts.svx"), concepts),
  writeIfMissing(join(targetRoot, ".brain", "architecture.svx"), architecture),
  writeIfMissing(join(targetRoot, ".brain", "build-process.svx"), buildProcess),
  writeIfMissing(join(targetRoot, ".brain", "review.svx"), review),
  updatePackageScripts(join(targetRoot, "package.json")),
];

for (const result of results) console.log(`${result.action.padEnd(8)} ${result.path}`);
console.log(`pi-notes Brain rig install complete for ${targetRoot}`);
