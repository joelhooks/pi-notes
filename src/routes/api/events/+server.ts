import type { RequestHandler } from "@sveltejs/kit";
import { existsSync, readFileSync, watch } from "node:fs";
import { join } from "node:path";
import { workspaceRoot } from "$lib/server/brain-pipeline";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const GET: RequestHandler = () => {
  const encoder = new TextEncoder();
  const root = workspaceRoot();
  const brainDir = join(root, ".brain");
  const bridgeDir = join(root, ".pi", "notes-bridge");
  const bridgeStatusPath = join(bridgeDir, "status.json");
  const bridgeEventsPath = join(bridgeDir, "events.jsonl");

  const readJson = (path: string) => {
    try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
  };

  const readLastBridgeEvent = () => {
    try {
      const lines = readFileSync(bridgeEventsPath, "utf8").trim().split("\n").filter(Boolean);
      return lines.length ? JSON.parse(lines[lines.length - 1] ?? "{}") : null;
    } catch { return null; }
  };

  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
          cleanup?.();
        }
      };

      send("ready", { path: ".brain", bridge: readJson(bridgeStatusPath), ts: Date.now() });

      const heartbeat = setInterval(() => send("ping", { bridge: readJson(bridgeStatusPath), ts: Date.now() }), 15_000);

      const brainWatcher = existsSync(brainDir)
        ? watch(brainDir, { recursive: true }, (_event, filename) => {
            if (!filename) return;
            const file = String(filename);
            if (!file.endsWith(".svx") && !file.endsWith(".json") && !file.endsWith(".db")) return;
            send("changed", { path: join(".brain", file), ts: Date.now() });
          })
        : undefined;

      const bridgeWatcher = existsSync(bridgeDir)
        ? watch(bridgeDir, (_event, filename) => {
            if (!filename) return;
            const file = String(filename);
            if (file === "status.json") send("bridge", { status: readJson(bridgeStatusPath), ts: Date.now() });
            if (file === "events.jsonl") send("agent", { event: readLastBridgeEvent(), ts: Date.now() });
          })
        : undefined;

      cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        brainWatcher?.close();
        bridgeWatcher?.close();
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
};
