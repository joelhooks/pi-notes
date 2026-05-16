import { json, type RequestHandler } from "@sveltejs/kit";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const bridgeDir = () => join(process.cwd(), ".pi", "notes-bridge");
const inboxDir = () => join(process.cwd(), ".pi", "notes-inbox");
const sessionPath = () => join(bridgeDir(), "session.json");
const traceLogPath = () => join(bridgeDir(), "events.jsonl");

function readSession() {
  if (!existsSync(sessionPath())) return undefined;
  return JSON.parse(readFileSync(sessionPath(), "utf8")) as { reviewBatchesUrl?: string };
}

function createBatchId() {
  return `batch_${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}_${randomUUID().slice(0, 8)}`;
}

function appendTrace(event: string, fields: Record<string, unknown>) {
  mkdirSync(bridgeDir(), { recursive: true });
  appendFileSync(traceLogPath(), `${JSON.stringify({ ts: new Date().toISOString(), event, ...fields })}\n`, "utf8");
}

export const GET: RequestHandler = () => {
  mkdirSync(inboxDir(), { recursive: true });
  const batches = readdirSync(inboxDir())
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 20)
    .map((file) => {
      const path = join(inboxDir(), file);
      const batch = JSON.parse(readFileSync(path, "utf8"));
      return { file, path, createdAt: batch.createdAt, documentId: batch.documentId, commentCount: batch.comments?.length ?? 0 };
    });

  return json({ ok: true, batches });
};

export const POST: RequestHandler = async ({ request }) => {
  mkdirSync(inboxDir(), { recursive: true });
  const payload = await request.json();
  const createdAt = new Date().toISOString();
  const batchId = typeof payload.batchId === "string" && payload.batchId.length > 0 ? payload.batchId : createBatchId();
  const backfilledBatchId = payload.batchId !== batchId;
  const file = `${batchId}.json`;
  const path = join(inboxDir(), file);
  const batch = { ...payload, batchId, createdAt };

  if (backfilledBatchId) appendTrace("batch.id.backfilled", { batchId, documentId: batch.documentId ?? null });
  appendTrace("document_host.received", { batchId, product: batch.product ?? null, documentId: batch.documentId ?? null });
  writeFileSync(path, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  appendTrace("document_host.receipt_saved", { batchId, file, path: `.pi/notes-inbox/${file}` });

  const bridgeUrl = readSession()?.reviewBatchesUrl;
  if (bridgeUrl) {
    try {
      appendTrace("document_host.forward.started", { batchId, bridgeUrl });
      const bridgeResponse = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
      });
      const bridge = await bridgeResponse.json().catch(() => ({}));
      if (!bridgeResponse.ok) {
        appendTrace("document_host.forward.failed", { batchId, bridgeUrl, status: bridgeResponse.status, bridge });
        return json({ ok: false, status: "saved_forward_failed", batchId, file, path, savedPath: `.pi/notes-inbox/${file}`, createdAt, bridge });
      }
      appendTrace("document_host.forward.succeeded", { batchId, bridgeUrl, bridge });
      return json({ ok: true, status: "delivered_to_pi", mode: "sent-to-pi", batchId, file, path, savedPath: `.pi/notes-inbox/${file}`, createdAt, bridge });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTrace("document_host.forward.failed", { batchId, bridgeUrl, error: message });
      return json({ ok: false, status: "saved_forward_failed", batchId, file, path, savedPath: `.pi/notes-inbox/${file}`, createdAt, error: message });
    }
  }

  appendTrace("document_host.forward.skipped", { batchId, reason: "missing_session_review_batches_url" });
  return json({ ok: false, status: "saved_forward_failed", batchId, file, path, savedPath: `.pi/notes-inbox/${file}`, createdAt, error: "missing session reviewBatchesUrl" });
};
