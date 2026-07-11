#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const stdin = await new Promise((resolveInput) => {
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    body += chunk;
  });
  process.stdin.on("end", () => resolveInput(body));
});

function parseInput(raw) {
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function nearestBrainRoot(start) {
  const gitRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: start,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  const candidates = [];
  if (gitRoot.status === 0 && gitRoot.stdout.trim()) {
    candidates.push(resolve(gitRoot.stdout.trim()));
  }

  let current = resolve(start);
  while (true) {
    candidates.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return candidates.find((candidate) => existsSync(join(candidate, ".brain")) || existsSync(join(candidate, "BRAIN.md")));
}

function walk(dir, predicate, limit = 500) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0 && out.length < limit) {
    const current = stack.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (predicate(path)) out.push(path);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function latestReviewBatch(root) {
  const inbox = join(root, ".pi", "notes-inbox");
  if (!existsSync(inbox)) return undefined;

  const files = readdirSync(inbox)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const path = join(inbox, name);
      return { name, path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (files.length === 0) return undefined;
  const latest = files[0];
  const batchId = latest.name.replace(/\.json$/, "");
  const receipt = join(root, ".pi", "notes-bridge", "receipts", `${batchId}.json`);
  return {
    count: files.length,
    latest: latest.name,
    latestHasReceipt: existsSync(receipt),
  };
}

function brainSummary(root) {
  const brainDir = join(root, ".brain");
  const svxFiles = existsSync(brainDir) ? walk(brainDir, (path) => path.endsWith(".svx")) : [];
  const componentFiles = existsSync(brainDir) ? walk(brainDir, (path) => path.includes(`${join(".brain", "components")}`) && path.endsWith(".svelte")) : [];
  const dataDir = join(brainDir, "data");
  return {
    hasBrainMd: existsSync(join(root, "BRAIN.md")),
    hasBrainDir: existsSync(brainDir),
    pageCount: svxFiles.length,
    componentCount: componentFiles.length,
    hasDataDir: existsSync(dataDir),
    latestBatch: latestReviewBatch(root),
  };
}

function buildContext(input, root, summary) {
  const event = input.hook_event_name || "UserPromptSubmit";
  const brainMdLabel = summary.hasBrainMd ? "`BRAIN.md`" : "no `BRAIN.md`";
  const brainDirLabel = summary.hasBrainDir ? "`.brain/`" : "no `.brain/`";
  const lines = [
    "# pi-notes Brain law",
    `Active repo has ${brainMdLabel} and ${brainDirLabel} at \`${root}\`.`,
    `Brain surface: ${summary.pageCount} .svx pages, ${summary.componentCount} local components${summary.hasDataDir ? ", .brain/data present" : ""}.`,
    "Before major edits or architecture claims, inspect `BRAIN.md` and the relevant `.brain/**/*.svx` pages.",
    "Capture durable decisions, terms, tradeoffs, source receipts, gotchas, review comments, reusable workflows, unresolved questions, and next steps in focused `.brain` topics.",
    "Do not use append-only logs as truth. Fold captures into PARA-shaped Brain pages and link related concepts.",
    "When creating or editing `.brain/**/*.svx`, `.brain/components`, `.brain/data`, or data-backed review surfaces, use the `brain-component-composition` skill.",
    "After Brain or code changes, prefer `pi-notes brain check` or this repo's `bun run brain:check`; run normal project checks when code changed.",
    "Codex bridge status: this hook makes Brain gardening model-visible. Browser Review Batch injection into the active Codex thread still needs the later app-server/MCP bridge.",
  ];

  if (summary.latestBatch) {
    lines.push(
      `Review Batch inbox: ${summary.latestBatch.count} saved batch file(s); latest \`${summary.latestBatch.latest}\` ${
        summary.latestBatch.latestHasReceipt ? "has" : "does not have"
      } a handled receipt.`,
    );
  }

  if (event === "UserPromptSubmit") {
    lines.push("For this prompt, explicitly decide whether Brain gardening applies. If it does, update the focused Brain topic and mention the receipt/check in the final answer.");
  }

  return lines.join("\n");
}

const input = parseInput(stdin);
const cwd = resolve(input.cwd || process.cwd());
const root = nearestBrainRoot(cwd);

if (!root) {
  process.stdout.write("{}");
  process.exit(0);
}

const summary = brainSummary(root);
const eventName = input.hook_event_name || "UserPromptSubmit";
const additionalContext = buildContext(input, root, summary);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext,
    },
  }),
);
