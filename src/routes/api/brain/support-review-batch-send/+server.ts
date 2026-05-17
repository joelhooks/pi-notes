import { json, type RequestHandler } from "@sveltejs/kit";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { workspaceRoot } from "$lib/server/brain-pipeline";

type Card = { cardId: string; conversationId?: string; subject?: string; draftHtml?: string; recommendedAction?: string; [key: string]: unknown };
type Run = { reviewRunId: string; cards?: Card[] };

function runsDir() { return join(workspaceRoot(), ".brain", "data", "support-review-runs"); }
function dbPath() { return join(workspaceRoot(), ".brain", "data", "support-review.db"); }
function bridgeStatusPath() { return join(workspaceRoot(), ".pi", "notes-bridge", "status.json"); }
function bridgeReviewBatchesUrls() {
  const urls: string[] = [];
  const path = bridgeStatusPath();
  if (existsSync(path)) {
    const status = JSON.parse(readFileSync(path, "utf8")) as { bridgeUrl?: string; reviewBatchesUrl?: string };
    if (status.reviewBatchesUrl) urls.push(status.reviewBatchesUrl);
    if (status.bridgeUrl) urls.push(`${status.bridgeUrl.replace(/\/$/, "")}/review-batches`);
  }
  urls.push("http://127.0.0.1:4290/review-batches");
  return [...new Set(urls)];
}
function loadRun(runId: string) {
  const path = join(runsDir(), `${runId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Run;
}
async function latestApprovals(cardIds: string[]) {
  const approvals = new Set<string>();
  if (!existsSync(dbPath())) return approvals;
  const client = createClient({ url: `file:${dbPath()}` });
  await client.execute(`create table if not exists operator_feedback (id integer primary key autoincrement, card_id text not null, verdict text not null, feedback text not null, source text not null, captured_at text not null, payload_json text not null)`);
  const result = await client.execute(`select card_id, verdict from operator_feedback order by captured_at asc, id asc`);
  client.close();
  const latest = new Map<string, string>();
  const cardSet = new Set(cardIds);
  for (const row of result.rows) {
    const cardId = String(row.card_id);
    if (!cardSet.has(cardId)) continue;
    const verdict = String(row.verdict);
    if (verdict === "approve" || verdict === "unapprove") latest.set(cardId, verdict);
  }
  for (const [cardId, verdict] of latest) if (verdict === "approve") approvals.add(cardId);
  return approvals;
}
async function writeReceipt(cardId: string, verdict: string, feedback: string, payload: unknown) {
  const client = createClient({ url: `file:${dbPath()}` });
  await client.execute(`create table if not exists operator_feedback (id integer primary key autoincrement, card_id text not null, verdict text not null, feedback text not null, source text not null, captured_at text not null, payload_json text not null)`);
  await client.execute({ sql: `insert into operator_feedback (card_id, verdict, feedback, source, captured_at, payload_json) values (?, ?, ?, ?, ?, ?)`, args: [cardId, verdict, feedback, "pi-notes.support-review-batch-send", new Date().toISOString(), JSON.stringify(payload)] });
  client.close();
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as { runId?: string };
  if (!body.runId) return json({ ok: false, error: "missing runId" }, { status: 400 });
  const run = loadRun(body.runId);
  if (!run) return json({ ok: false, error: "run not found" }, { status: 404 });
  const cards = run.cards ?? [];
  const approvals = await latestApprovals(cards.map((card) => card.cardId));
  const approvedCards = cards.filter((card) => approvals.has(card.cardId) && card.draftHtml && card.recommendedAction === "reply");
  const urls = bridgeReviewBatchesUrls();
  const batch = {
    type: "support-review-send-approved-batch",
    product: "aihero",
    documentId: body.runId,
    comments: approvedCards.map((card) => ({ id: `send-${card.cardId}-${Date.now()}`, kind: "send_approved", blockIds: [card.cardId], comment: "Send exact approved draftHtml only.", currentText: card.draftHtml, conversationId: card.conversationId, subject: card.subject })),
    expectedAgentAction: [
      "Use /skill:aih-triage and delegate to aih-approved-reply-sender if available.",
      "For each approved card, send only the exact approved draftHtml to the matching Front conversation.",
      "Do not archive, tag, assign, write Kit, write Contact State, or alter unlisted conversations.",
      "Before each send, refresh the Front conversation and short-circuit if it has new inbound, is closed, or no longer matches the approved card.",
      "Write per-card send receipts back to the support review run and report successes/failures.",
    ].join("\n"),
  };
  let payload: unknown = null;
  let deliveredUrl = "";
  let lastError = "bridge unavailable";
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(batch) });
      payload = await response.json().catch(() => null);
      if (response.ok) { deliveredUrl = url; break; }
      lastError = `bridge failed at ${url}`;
    } catch (error) {
      lastError = error instanceof Error ? `${url}: ${error.message}` : `${url}: failed`;
    }
  }
  if (!deliveredUrl) return json({ ok: false, error: lastError, tried: urls }, { status: 503 });
  for (const card of approvedCards) await writeReceipt(card.cardId, "send_approved", "Queued in approved batch for exact draftHtml send.", { runId: body.runId, cardId: card.cardId, bridgePayload: payload, deliveredUrl });
  return json({ ok: true, status: "sent_to_pi", runId: body.runId, queued: approvedCards.length, deliveredUrl, payload });
};
