import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { Type } from "typebox";

type ReviewBatchComment = {
  id?: string;
  kind?: string;
  blockIds?: string[];
  comment?: string;
  currentText?: string;
};

type ReviewBatch = {
  batchId?: string;
  type?: string;
  product?: string;
  documentId?: string;
  createdAt?: string;
  comments?: ReviewBatchComment[];
  expectedAgentAction?: string;
};

type InboxBatch = {
  file: string;
  path: string;
  batch: ReviewBatch;
};

type ProcessedState = {
  processed: string[];
  updatedAt?: string;
};

type WatchState = "disconnected" | "connected" | "watching" | "sending" | "sent" | "failed";

const FALLBACK_PI_NOTES_BRAIN_SYSTEM = `
# pi-notes brain

Use pi-notes as an agent-connected project brain, not a generic notes site.

- Organize by usefulness: Projects, Areas, Resources, Archives.
- Ask: Where will this be useful next?
- Keep notes atomic, linked, and source-grounded.
- Capture only durable decisions, terms, tradeoffs, gotchas, sources, questions, and review feedback.
- Refine captures into graph edges, backlinks, summaries, and canonical concepts.
- Express knowledge as code, docs, decisions, UI, issues, or plans. Storage is not the goal; output is.
- Browser pages are read/review surfaces. Agents own source edits and must leave receipts.
- Avoid bloated PKM ceremony, append-only logs as truth, Obsidian cloning, and generic static-site sludge.
`.trim();

function brainSystemPrompt() {
  const localBrainPath = join(process.cwd(), "BRAIN.md");
  const hasLocalBrain = existsSync(localBrainPath);
  const hasBrainDir = existsSync(join(process.cwd(), ".brain"));
  const base = hasLocalBrain ? readFileSync(localBrainPath, "utf8").trim() : FALLBACK_PI_NOTES_BRAIN_SYSTEM;
  return [
    base,
    "",
    "# pi-notes local Brain state",
    hasLocalBrain ? "- Local `BRAIN.md` is present and is the active operating layer." : "- No local `BRAIN.md` exists yet; use the bundled pi-notes default operating layer.",
    hasBrainDir ? "- Local `.brain/` exists; use it as the durable project knowledge graph." : "- Local `.brain/` was not present at startup; pi-notes should initialize it automatically on first session start.",
    "- Prefer local Brain entries for durable notes, decisions, diagrams, and review receipts.",
    "- Local projects may customize Brain rendering with `.brain/components/**/*.svelte`, `.brain/data/**`, `.brain/components.config.ts`, and `.brain/pipeline.config.ts`.",
    "- Brain `.svx` documents use the real MDSvX/unified pipeline when rendered by the Document Host. Prefer project-local components over standalone prototype pages.",
    "- Component resolution is project override first, pi-notes standard component second, clear missing-component error card third.",
    "- Local `remarkPlugins` and `rehypePlugins` must be explicit and safe. After changing the pipeline, run the pi-notes check and open the affected note in the Document Host.",
  ].join("\n");
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

function isAllowedBrainFile(path: string) {
  if (path.endsWith(".svx")) return true;
  if (path.startsWith(".brain/data/")) return true;
  if (path.startsWith(".brain/components/") && path.endsWith(".svelte")) return true;
  if (/^\.brain\/[^/]+\.config\.[tj]s$/.test(path)) return true;
  return false;
}

function componentPerformanceWarnings(path: string, source: string) {
  const warnings: string[] = [];
  if (source.includes("<video") && !/preload\s*=\s*["']none["']/.test(source)) warnings.push(`${path}: data-backed videos should use preload=\"none\"`);
  if (source.includes("<img") && !/loading\s*=\s*["']lazy["']/.test(source)) warnings.push(`${path}: data-backed images should use loading=\"lazy\"`);
  if (source.includes("{@html") && /\b(record|item|row|tweet|source|text|body|content)\b/i.test(source)) warnings.push(`${path}: render raw source fields as text, not {@html ...}`);
  if ((source.includes("../data/") || source.includes(".brain/data")) && source.includes("{#each") && !/\b(page|visible|virtual|slice|limit|offset)\b/i.test(source)) warnings.push(`${path}: large data-backed lists should paginate or virtualize`);
  return warnings;
}

function checkLocalBrain(root = process.cwd()) {
  const brainDir = join(root, ".brain");
  const errors: string[] = [];
  const warnings: string[] = [];
  let pageCount = 0;

  if (!existsSync(brainDir)) {
    errors.push("missing .brain/ directory");
  } else {
    const files = walkFiles(brainDir).map((path) => path.slice(root.length + 1));
    const svxFiles = files.filter((path) => path.endsWith(".svx"));
    const invalidFiles = files.filter((path) => !isAllowedBrainFile(path));
    pageCount = svxFiles.length;

    if (!existsSync(join(brainDir, "index.svx"))) errors.push("missing .brain/index.svx");
    if (svxFiles.length === 0) errors.push(".brain/ contains no .svx pages");
    for (const file of invalidFiles) errors.push(`unsupported Brain support file: ${file}`);
    for (const file of files.filter((path) => path.startsWith(".brain/components/") && path.endsWith(".svelte"))) {
      warnings.push(...componentPerformanceWarnings(file, readFileSync(join(root, file), "utf8")));
    }
  }

  return {
    ok: errors.length === 0,
    pageCount,
    errors,
    warnings,
    text: [`Brain pages: ${pageCount}`, ...warnings.map((warning) => `brain check warning: ${warning}`), errors.length ? errors.map((error) => `brain check error: ${error}`).join("\n") : "brain check passed"].join("\n"),
  };
}

function initLocalBrain() {
  const brainDir = join(process.cwd(), ".brain");
  const created: string[] = [];
  if (!existsSync(brainDir)) {
    mkdirSync(join(brainDir, "projects"), { recursive: true });
    mkdirSync(join(brainDir, "areas"), { recursive: true });
    mkdirSync(join(brainDir, "resources"), { recursive: true });
    mkdirSync(join(brainDir, "archives"), { recursive: true });
    created.push(".brain/");
  }

  const indexPath = join(brainDir, "index.svx");
  if (!existsSync(indexPath)) {
    writeFileSync(
      indexPath,
      [
        "# Project Brain",
        "",
        "The rendered Brain index is programmatic.",
        "",
        "Open `/notes` in the local pi-notes Document Host to browse entries sorted by PARA.",
        "",
        "Do not maintain a manual page list here; `.brain/**/*.svx` is discovered automatically.",
        "",
      ].join("\n"),
      "utf8",
    );
    created.push(".brain/index.svx");
  }

  const brainPath = join(process.cwd(), "BRAIN.md");
  if (!existsSync(brainPath)) {
    writeFileSync(brainPath, `${FALLBACK_PI_NOTES_BRAIN_SYSTEM}\n`, "utf8");
    created.push("BRAIN.md");
  }

  mkdirSync(join(process.cwd(), "docs", "diagrams"), { recursive: true });
  return created;
}

function bridgeDir() {
  return join(process.cwd(), ".pi", "notes-bridge");
}

function inboxDir() {
  return join(process.cwd(), ".pi", "notes-inbox");
}

function sessionPath() {
  return join(bridgeDir(), "session.json");
}

function processedPath() {
  return join(bridgeDir(), "processed.json");
}

function statusPath() {
  return join(bridgeDir(), "status.json");
}

function traceLogPath() {
  return join(bridgeDir(), "events.jsonl");
}

function documentHostLogPath() {
  return join(bridgeDir(), "document-host.log");
}

function documentHostPidPath() {
  return join(bridgeDir(), "document-host.pid");
}

let documentHostPort = Number(process.env.PI_NOTES_PORT ?? 4188);
let bridgePort = Number(process.env.PI_NOTES_BRIDGE_PORT ?? 4288);

function localUrl(route = "/notes") {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `http://127.0.0.1:${documentHostPort}${normalizedRoute}`;
}

function portlessUrl(route = "/notes") {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `https://pi-notes-${documentHostPort}.localhost${normalizedRoute}`;
}

function bridgeUrl(path = "") {
  return `http://127.0.0.1:${bridgePort}${path}`;
}

async function findFreePort(start: number) {
  for (let port = start; port < start + 100; port += 1) {
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No free port found from ${start}`);
}

function readJsonFile<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function fallbackBatchId() {
  return `batch_${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}_${Math.random().toString(16).slice(2, 8)}`;
}

function withBatchId(batch: ReviewBatch): ReviewBatch & { batchId: string } {
  return { ...batch, batchId: batch.batchId ?? fallbackBatchId() };
}

function appendTrace(event: string, fields: Record<string, unknown>) {
  mkdirSync(bridgeDir(), { recursive: true });
  appendFileSync(
    traceLogPath(),
    `${JSON.stringify({ ts: new Date().toISOString(), event, ...fields })}\n`,
    "utf8",
  );
}

function listInboxBatches() {
  if (!existsSync(inboxDir())) return [];
  return readdirSync(inboxDir()).filter((entry) => entry.endsWith(".json")).sort();
}

function readInboxBatch(file: string): InboxBatch | undefined {
  const path = join(inboxDir(), file);
  const batch = readJsonFile<ReviewBatch>(path);
  if (!batch) return undefined;
  return { file, path, batch };
}

function latestInboxBatch() {
  const file = listInboxBatches().at(-1);
  if (!file) return undefined;
  return readInboxBatch(file);
}

function readProcessedState(): ProcessedState {
  if (!existsSync(processedPath())) return { processed: [] };
  return readJsonFile<ProcessedState>(processedPath()) ?? { processed: [] };
}

function writeProcessedState(state: ProcessedState) {
  mkdirSync(bridgeDir(), { recursive: true });
  writeFileSync(processedPath(), `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

function writeBridgeStatus(state: WatchState, route = "/notes") {
  mkdirSync(bridgeDir(), { recursive: true });
  writeFileSync(
    statusPath(),
    `${JSON.stringify(
      {
        state,
        route,
        url: localUrl(route),
        preferredUrl: portlessUrl(route),
        bridgeUrl: bridgeUrl(),
        eventsUrl: bridgeUrl("/events"),
        reviewBatchesUrl: bridgeUrl("/review-batches"),
        portlessOptional: true,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function markProcessed(file: string) {
  const state = readProcessedState();
  if (!state.processed.includes(file)) state.processed.push(file);
  writeProcessedState({ processed: state.processed.sort() });
}

function nextUnprocessedBatch() {
  const processed = new Set(readProcessedState().processed);
  for (const file of listInboxBatches()) {
    if (processed.has(file)) continue;
    const batch = readInboxBatch(file);
    if (batch) return batch;
  }
  return undefined;
}

function formatBatchForAgent(file: string, batch: ReviewBatch) {
  const comments = (batch.comments ?? [])
    .map((comment) =>
      [
        `## ${comment.id ?? "unknown"}: ${comment.kind ?? "comment"} on ${(comment.blockIds ?? []).join(", ")}`,
        "",
        comment.comment ?? "",
        "",
        "Current text:",
        "",
        comment.currentText ?? "",
      ].join("\n"),
    )
    .join("\n\n---\n\n");

  const batchId = batch.batchId ?? "unknown";
  return [
    "# pi-notes Review Batch",
    "",
    `Batch ID: ${batchId}`,
    `File: .pi/notes-inbox/${file}`,
    `Type: ${batch.type ?? "unknown"}`,
    `Product: ${batch.product ?? "unknown"}`,
    `Document: ${batch.documentId ?? "unknown"}`,
    `Created: ${batch.createdAt ?? "unknown"}`,
    "",
    comments || "No comments.",
    "",
    "Expected agent action:",
    batch.expectedAgentAction ?? "Handle this pi-notes feedback and report handled/partial/unhandled comment ids.",
    "",
    "After handling, write a Review Receipt JSON file at:",
    `.pi/notes-bridge/receipts/${batchId}.json`,
    "",
    "Receipt shape:",
    "```json",
    JSON.stringify(
      {
        batchId,
        status: "handled | partial | unhandled",
        handledCommentIds: [],
        partiallyHandledCommentIds: [],
        unhandledCommentIds: [],
        changedFiles: [],
        notes: "what changed or why nothing changed",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "```",
  ].join("\n");
}

export default function piNotes(pi: ExtensionAPI) {
  let watchTimer: ReturnType<typeof setInterval> | undefined;
  let watchState: WatchState = existsSync(sessionPath()) ? "connected" : "disconnected";
  let activeRoute = "/notes";
  let sendQueue: Promise<void> = Promise.resolve();
  let bridgeServer: Server | undefined;
  let documentHost: ChildProcess | undefined;
  const sseClients = new Set<ServerResponse>();

  const emitBridgeEvent = (event: string, data: Record<string, unknown>) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) client.write(payload);
  };

  const setBridgeState = (state: WatchState) => {
    watchState = state;
    writeBridgeStatus(watchState, activeRoute);
    emitBridgeEvent("bridge", {
      state: watchState,
      route: activeRoute,
      url: localUrl(activeRoute),
      preferredUrl: portlessUrl(activeRoute),
      bridgeUrl: bridgeUrl(),
      updatedAt: new Date().toISOString(),
    });
  };

  const enqueueSend = (file: string, batchInput: ReviewBatch, notify = false) => {
    const batch = withBatchId(batchInput);
    appendTrace("pi_bridge.enqueue", { batchId: batch.batchId, file, product: batch.product ?? null, documentId: batch.documentId ?? null });

    const task = sendQueue.then(async () => {
      try {
        setBridgeState("sending");
        appendTrace("pi_bridge.send.started", { batchId: batch.batchId, file });
        const message = formatBatchForAgent(file, batch);
        try {
          pi.sendUserMessage(message, { deliverAs: "followUp" });
        } catch {
          pi.sendUserMessage(message);
        }
        markProcessed(file);
        setBridgeState("sent");
        appendTrace("pi_bridge.send.succeeded", { batchId: batch.batchId, file, receiptPath: `.pi/notes-bridge/receipts/${batch.batchId}.json` });
        pi.appendEntry("pi-notes-batch-sent", {
          batchId: batch.batchId,
          file,
          sentAt: new Date().toISOString(),
          product: batch.product ?? null,
          documentId: batch.documentId ?? null,
          commentCount: batch.comments?.length ?? 0,
          receiptPath: `.pi/notes-bridge/receipts/${batch.batchId}.json`,
        });
        if (notify) pi.setStatus?.("pi-notes", `sent ${file}`);
      } catch (error: unknown) {
        setBridgeState("failed");
        appendTrace("pi_bridge.send.failed", { batchId: batch.batchId, file, error: error instanceof Error ? error.message : String(error) });
        pi.appendEntry("pi-notes-batch-send-failed", {
          batchId: batch.batchId,
          file,
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    sendQueue = task.catch(() => undefined);
    return task.then(() => batch);
  };

  const sendBatch = async (latest: InboxBatch, notify = false) => {
    await enqueueSend(latest.file, latest.batch, notify);
  };

  const pollInbox = async (notify = false) => {
    if (!existsSync(sessionPath())) {
      setBridgeState("disconnected");
      return;
    }
    const next = nextUnprocessedBatch();
    if (!next) {
      setBridgeState(watchTimer ? "watching" : "connected");
      return;
    }
    await sendBatch(next, notify);
  };

  const startWatch = () => {
    if (watchTimer) return false;
    setBridgeState("watching");
    void pollInbox(true);
    watchTimer = setInterval(() => void pollInbox(true), 1_500);
    return true;
  };

  const stopWatch = () => {
    if (!watchTimer) return false;
    clearInterval(watchTimer);
    watchTimer = undefined;
    setBridgeState(existsSync(sessionPath()) ? "connected" : "disconnected");
    return true;
  };

  const sendDirectBatch = async (batch: ReviewBatch) => {
    const hydrated = withBatchId({ ...batch, createdAt: batch.createdAt ?? new Date().toISOString() });
    const file = `direct-${hydrated.batchId}.json`;
    try {
      const sentBatch = await enqueueSend(file, hydrated);
      emitBridgeEvent("sent", { ok: true, batchId: sentBatch.batchId, documentId: sentBatch.documentId ?? null, commentCount: sentBatch.comments?.length ?? 0 });
      return sentBatch;
    } catch (error) {
      emitBridgeEvent("failed", { ok: false, batchId: hydrated.batchId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  };

  const startBridgeServer = async () => {
    if (bridgeServer) return false;
    bridgePort = await findFreePort(bridgePort);
    bridgeServer = createServer((req, res) => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "GET" && req.url === "/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        sseClients.add(res);
        res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, state: watchState, route: activeRoute })}\n\n`);
        req.on("close", () => sseClients.delete(res));
        return;
      }

      if (req.method === "POST" && req.url === "/review-batches") {
        let body = "";
        req.on("data", (chunk) => (body += String(chunk)));
        req.on("end", () => {
          const batch = withBatchId(JSON.parse(body || "{}") as ReviewBatch);
          appendTrace("pi_bridge.received", { batchId: batch.batchId, bytes: body.length, route: activeRoute });
          pi.appendEntry("pi-notes-direct-batch-received", {
            batchId: batch.batchId,
            receivedAt: new Date().toISOString(),
            bytes: body.length,
            route: activeRoute,
          });
          void sendDirectBatch(batch)
            .then((sentBatch) => {
              res.writeHead(200, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: true, status: "delivered_to_pi", mode: "sent-direct-to-pi", batchId: sentBatch.batchId, state: watchState }));
            })
            .catch((error: unknown) => {
              res.writeHead(500, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: false, status: "bridge_send_failed", batchId: batch.batchId, error: error instanceof Error ? error.message : String(error) }));
            });
        });
        return;
      }

      if (req.method === "GET" && req.url === "/status") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, state: watchState, route: activeRoute, url: localUrl(activeRoute) }));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not found" }));
    });
    bridgeServer.on("error", (error: NodeJS.ErrnoException) => {
      appendTrace("pi_bridge.listen.failed", { port: bridgePort, error: error.message, code: error.code ?? null });
      pi.appendEntry("pi-notes-bridge-listen-failed", { port: bridgePort, error: error.message, code: error.code ?? null });
      bridgeServer = undefined;
      setBridgeState("failed");
    });
    bridgeServer.listen(bridgePort, "127.0.0.1");
    appendTrace("pi_bridge.listen.started", { port: bridgePort, url: bridgeUrl() });
    return true;
  };

  const stopBridgeServer = () => {
    for (const client of sseClients) client.end();
    sseClients.clear();
    bridgeServer?.close();
    bridgeServer = undefined;
  };

  const isDocumentHostReachable = async () => {
    try {
      const response = await fetch(localUrl("/api/session"));
      if (!response.ok) return false;
      const payload = (await response.json()) as { cwd?: string; session?: { cwd?: string } };
      return payload.cwd === process.cwd() || payload.session?.cwd === process.cwd();
    } catch {
      return false;
    }
  };

  const ensureDocumentHost = async () => {
    if (await isDocumentHostReachable()) return false;
    if (documentHost && !documentHost.killed) return true;
    documentHostPort = await findFreePort(documentHostPort);
    mkdirSync(bridgeDir(), { recursive: true });
    const logFd = openSync(documentHostLogPath(), "a");
    documentHost = spawn("bun", ["run", "dev"], {
      cwd: process.cwd(),
      detached: true,
      env: { ...process.env, PI_NOTES_PORT: String(documentHostPort), PI_NOTES_WORKSPACE_ROOT: process.cwd(), VITE_PI_NOTES_WORKSPACE_ROOT: process.cwd() },
      stdio: ["ignore", logFd, logFd],
    });
    if (documentHost.pid) writeFileSync(documentHostPidPath(), `${documentHost.pid}\n`, "utf8");
    documentHost.unref();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    return true;
  };

  const stopDocumentHost = () => {
    documentHost?.kill();
    documentHost = undefined;
  };

  const connectCurrentSession = async (ctx: Parameters<Parameters<typeof pi.on>[1]>[1], route = "/notes") => {
    mkdirSync(bridgeDir(), { recursive: true });
    activeRoute = route;
    await ensureDocumentHost();
    await startBridgeServer();
    const state = {
      connected: true,
      connectedAt: new Date().toISOString(),
      cwd: process.cwd(),
      sessionFile: ctx.sessionManager.getSessionFile?.() ?? null,
      leafId: ctx.sessionManager.getLeafId?.() ?? null,
      route,
      url: localUrl(route),
      preferredUrl: portlessUrl(route),
      bridgeUrl: bridgeUrl(),
      eventsUrl: bridgeUrl("/events"),
      reviewBatchesUrl: bridgeUrl("/review-batches"),
      bridgeMode: "sse-direct",
      portlessOptional: true,
    };
    writeFileSync(sessionPath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
    setBridgeState("connected");
    pi.appendEntry("pi-notes-connected", state);
    return state;
  };

  pi.on("session_start", async (_event, ctx) => {
    const created = initLocalBrain();
    if (created.length > 0) {
      pi.appendEntry("pi-notes-brain-initialized", { created, cwd: process.cwd(), initializedAt: new Date().toISOString() });
      ctx.ui.notify(`pi-notes initialized local Brain: ${created.join(", ")}`, "info");
    }
    const state = await connectCurrentSession(ctx, "/notes");
    pi.setStatus?.("pi-notes", `brain ${state.url}`);
  });

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${brainSystemPrompt()}`,
  }));

  pi.registerCommand("notes", {
    description: "Open/connect/process local pi-notes review documents",
    handler: async (args, ctx) => {
      const [subcommand = "help", ...rest] = args.trim().split(/\s+/).filter(Boolean);

      if (subcommand === "connect" || subcommand === "open" || subcommand === "brain") {
        const state = await connectCurrentSession(ctx, rest[0] || "/notes");
        ctx.ui.notify(`pi-notes SSE bridge: ${state.url} (portless: ${state.preferredUrl} if configured)`, "success");
        return;
      }

      if (subcommand === "inbox") {
        const latest = latestInboxBatch();
        if (!latest) {
          ctx.ui.notify("pi-notes inbox is empty", "info");
          return;
        }
        await sendBatch(latest, true);
        ctx.ui.notify(`pi-notes injected ${latest.file}`, "success");
        return;
      }

      if (subcommand === "watch") {
        if (!existsSync(sessionPath())) {
          ctx.ui.notify("pi-notes needs /notes connect before /notes watch", "error");
          return;
        }
        startBridgeServer();
        setBridgeState("connected");
        ctx.ui.notify(`pi-notes SSE bridge ready: ${bridgeUrl("/events")}`, "success");
        return;
      }

      if (subcommand === "unwatch") {
        stopWatch();
        stopBridgeServer();
        setBridgeState(existsSync(sessionPath()) ? "connected" : "disconnected");
        ctx.ui.notify("pi-notes bridge stopped", "info");
        return;
      }

      if (subcommand === "status") {
        const connected = existsSync(sessionPath()) ? readJsonFile<Record<string, unknown>>(sessionPath()) : null;
        const latest = latestInboxBatch();
        const processed = readProcessedState().processed.length;
        const route = typeof connected?.route === "string" ? connected.route : activeRoute;
        ctx.ui.notify(
          `pi-notes status: ${connected ? watchState : "not connected"}; ${localUrl(route)}; inbox ${latest ? latest.file : "empty"}; processed ${processed}`,
          "info",
        );
        return;
      }

      if (subcommand === "check" || (subcommand === "brain" && rest[0] === "check")) {
        const result = checkLocalBrain();
        ctx.ui.notify(result.text, result.ok ? "success" : "error");
        pi.appendEntry("pi-notes-brain-check", { ...result, checkedAt: new Date().toISOString(), cwd: process.cwd() });
        return;
      }

      ctx.ui.notify("pi-notes: use /notes open, /notes connect, /notes unwatch, /notes inbox, /notes status, or /notes check", "info");
    },
  });

  pi.registerTool({
    name: "pi_notes_create_review",
    label: "Create Pi Note Review",
    description: "Create a product-namespaced local review document scaffold. Implementation currently records intent only.",
    promptSnippet: "Create or open product-namespaced pi-notes review documents",
    promptGuidelines: [
      "Use pi_notes_create_review when the user asks to create a local pi-notes review document connected to the current Pi session.",
    ],
    parameters: Type.Object({
      product: Type.String({ description: "Product namespace slug, e.g. aihero or joelclaw" }),
      title: Type.String({ description: "Human-readable review document title" }),
      sourcePath: Type.Optional(Type.String({ description: "Optional source file path backing the review document" })),
    }),
    async execute(_toolCallId, params) {
      pi.appendEntry("pi-notes-review-intent", {
        ...params,
        createdAt: new Date().toISOString(),
      });

      return {
        content: [
          {
            type: "text",
            text: `Recorded pi-notes review intent for ${params.product}: ${params.title}`,
          },
        ],
        details: params,
      };
    },
  });

  pi.registerTool({
    name: "pi_notes_brain_check",
    label: "Check Pi Notes Brain",
    description: "Validate the local .brain/ graph using the pi-notes extension's bundled checker. Does not require a global pi-notes binary.",
    parameters: Type.Object({}),
    async execute() {
      const result = checkLocalBrain();
      pi.appendEntry("pi-notes-brain-check", { ...result, checkedAt: new Date().toISOString(), cwd: process.cwd() });
      return {
        content: [{ type: "text", text: result.text }],
        details: result,
        isError: !result.ok,
      };
    },
  });

  pi.registerTool({
    name: "pi_notes_latest_batch",
    label: "Read latest pi-notes batch",
    description: "Read and format the latest saved pi-notes Review Batch from .pi/notes-inbox.",
    parameters: Type.Object({}),
    async execute() {
      const latest = latestInboxBatch();
      if (!latest) return { content: [{ type: "text", text: "pi-notes inbox is empty." }] };
      return {
        content: [{ type: "text", text: formatBatchForAgent(latest.file, latest.batch) }],
        details: { file: latest.file, path: latest.path, batch: latest.batch },
      };
    },
  });

  pi.on("session_shutdown", async () => {
    stopWatch();
    stopBridgeServer();
  });
}
