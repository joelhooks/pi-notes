import type { RequestHandler } from "@sveltejs/kit";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const GET: RequestHandler = () => {
  const encoder = new TextEncoder();
  const brainDir = join(process.cwd(), ".brain");

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

      send("ready", { path: ".brain", ts: Date.now() });

      const heartbeat = setInterval(() => send("ping", { ts: Date.now() }), 15_000);

      const watcher = existsSync(brainDir)
        ? watch(brainDir, { recursive: true }, (_event, filename) => {
            if (!filename || !String(filename).endsWith(".svx")) return;
            send("changed", { path: join(".brain", String(filename)), ts: Date.now() });
          })
        : undefined;

      cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        watcher?.close();
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
