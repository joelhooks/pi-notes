import { json, type RequestHandler } from "@sveltejs/kit";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@libsql/client";
import { workspaceRoot } from "$lib/server/brain-pipeline";

type Card = { cardId: string; conversationId?: string; subject?: string; draftHtml?: string; recommendedAction?: string; status?: string; bucket?: "active" | "processing" | "revised_ready" | "done"; updatedAt?: string; [key: string]: unknown };
type Run = { reviewRunId: string; status?: string; cards?: Card[] };
const execFileAsync = promisify(execFile);

function runsDir() { return join(workspaceRoot(), ".brain", "data", "support-review-runs"); }
function dbPath() { return join(workspaceRoot(), ".brain", "data", "support-review.db"); }
function runPath(runId: string) { return join(runsDir(), `${runId}.json`); }
function triagePath() { return join(workspaceRoot(), ".brain", "triage.svx"); }
function supportEventsPath() { return join(workspaceRoot(), ".brain", "data", "support-review-events.jsonl"); }
function emitSupportEvent(event: Record<string, unknown>) {
  appendFileSync(supportEventsPath(), `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
}
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
  const path = runPath(runId);
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
function rebuildActiveTriage(run: Run) {
  const activeCards = (run.cards ?? []).filter((card) => card.bucket !== "done" && !(card.sentReceipt || card.archiveReceipt || card.applyReceipt || String(card.status ?? "").startsWith("sent_") || String(card.status ?? "").startsWith("archived_") || String(card.status ?? "") === "approved_no_action_done"));
  const doneCards = (run.cards ?? []).length - activeCards.length;
  const body = [
    "---",
    "title: AIH Triage",
    "status: active",
    "---",
    "",
    "# AIH Triage",
    "",
    "Active HITL work only. Completed sends, archives, and no-action approvals stay in the daily support run logs.",
    "",
    `- Run: \`${run.reviewRunId}\``,
    `- Active cards: ${activeCards.length}`,
    `- Logged/done cards: ${doneCards}`,
    "",
    "## Active cards",
    "",
    ...activeCards.map((card) => `<SupportReplyCard cardId=\"${card.cardId}\" />\n`),
  ].join("\n");
  writeFileSync(triagePath(), `${body}\n`, "utf8");
}

async function writeReceipt(cardId: string, verdict: string, feedback: string, payload: unknown) {
  const client = createClient({ url: `file:${dbPath()}` });
  await client.execute(`create table if not exists operator_feedback (id integer primary key autoincrement, card_id text not null, verdict text not null, feedback text not null, source text not null, captured_at text not null, payload_json text not null)`);
  await client.execute({ sql: `insert into operator_feedback (card_id, verdict, feedback, source, captured_at, payload_json) values (?, ?, ?, ?, ?, ?)`, args: [cardId, verdict, feedback, "pi-notes.support-review-batch-send", new Date().toISOString(), JSON.stringify(payload)] });
  client.close();
}

async function sendApprovedReplies(run: Run, approvedCards: Card[]) {
  const now = new Date().toISOString();
  const tempDir = mkdtempSync(join(tmpdir(), "aih-approved-replies-"));
  const results: Array<Record<string, unknown>> = [];
  for (const card of approvedCards) {
    if (!card.conversationId || !card.draftHtml) continue;
    emitSupportEvent({ type: "support_review.action_started", runId: run.reviewRunId, cardId: card.cardId, action: "send_approved_reply" });
    try {
      await execFileAsync("skill", ["front", "messages", card.conversationId, "--format", "machine", "--refresh"], { cwd: workspaceRoot() });
      const bodyPath = join(tempDir, `${card.conversationId}.html`);
      writeFileSync(bodyPath, String(card.draftHtml), "utf8");
      const { stdout } = await execFileAsync("skill", ["front", "send", card.conversationId, "--body-file", bodyPath, "--author", "tea_hjx3", "--json"], { cwd: workspaceRoot() });
      const result = JSON.parse(stdout);
      card.status = "sent_approved";
      card.bucket = "done";
      card.updatedAt = now;
      card.sendGate = "sent";
      card.sentReceipt = { sentAt: now, sent: true, conversationId: card.conversationId, messageId: result.messageId ?? result.data?.messageId, frontAuthor: "tea_hjx3", archive: false, tag: false, assign: false, kitWrite: false, contactStateWrite: false, exactDraftHtmlSent: card.draftHtml, command: `skill front send ${card.conversationId} --body-file ${bodyPath} --author tea_hjx3 --json`, preSendSafety: "Front conversation refreshed before send. Sent exact approved draftHtml." };
      const trace = Array.isArray(card.gateTrace) ? card.gateTrace : [];
      trace.push({ label: "approved_send", status: "sent", detail: `Sent exact approved draftHtml as msg ${result.messageId ?? result.data?.messageId ?? "unknown"}.` });
      card.gateTrace = trace;
      await writeReceipt(card.cardId, "send_approved_done", "Sent approved draftHtml.", { runId: run.reviewRunId, cardId: card.cardId, result });
      emitSupportEvent({ type: "support_review.action_done", runId: run.reviewRunId, cardId: card.cardId, action: "send_approved_reply", messageId: result.messageId ?? result.data?.messageId });
      results.push({ cardId: card.cardId, ok: true, messageId: result.messageId ?? result.data?.messageId });
    } catch (error) {
      card.status = "send_failed_needs_operator";
      card.bucket = "active";
      card.updatedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      await writeReceipt(card.cardId, "send_failed", message, { runId: run.reviewRunId, cardId: card.cardId });
      emitSupportEvent({ type: "support_review.action_failed", runId: run.reviewRunId, cardId: card.cardId, action: "send_approved_reply", error: message });
      results.push({ cardId: card.cardId, ok: false, error: message });
    }
  }
  run.status = approvedCards.length > 0 ? "active_triage_updated" : run.status;
  writeFileSync(runPath(run.reviewRunId), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  rebuildActiveTriage(run);
  emitSupportEvent({ type: "support_review.triage_rebuilt", runId: run.reviewRunId, activeCount: (run.cards ?? []).filter((card) => card.bucket !== "done").length });
  return { sent: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}

async function applyApprovedDone(run: Run, approvedCards: Card[]) {
  const now = new Date().toISOString();
  const archiveCards = approvedCards.filter((card) => String(card.recommendedAction ?? "").includes("archive"));
  let archiveResult: unknown = null;
  if (archiveCards.length > 0) {
    const ids = archiveCards.map((card) => String(card.conversationId)).filter(Boolean);
    const { stdout } = await execFileAsync("skill", ["front", "archive", ...ids, "--json"], { cwd: workspaceRoot() });
    archiveResult = JSON.parse(stdout);
  }
  for (const card of approvedCards) {
    const actionKind = String(card.recommendedAction ?? "").includes("archive") ? "archive_approved" : "action_done";
    if (String(card.recommendedAction ?? "").includes("archive")) {
      card.status = "archived_approved";
      card.bucket = "done";
      card.updatedAt = now;
      card.archiveReceipt = { archivedAt: now, conversationId: card.conversationId, command: "skill front archive --json", success: true, reason: `Approved action: ${card.recommendedAction}`, result: archiveResult };
      await writeReceipt(card.cardId, "archive_approved", `Archived approved action: ${card.recommendedAction}.`, { runId: run.reviewRunId, cardId: card.cardId, archiveResult });
    } else {
      card.status = "approved_no_action_done";
      card.bucket = "done";
      card.updatedAt = now;
      card.applyReceipt = { appliedAt: now, conversationId: card.conversationId, recommendedAction: card.recommendedAction, success: true, reason: "Approved no-action/no-reply recommendation processed." };
      await writeReceipt(card.cardId, "action_done", `Processed approved action: ${card.recommendedAction}.`, { runId: run.reviewRunId, cardId: card.cardId });
    }
    const trace = Array.isArray(card.gateTrace) ? card.gateTrace : [];
    trace.push({ label: "approved_action", status: String(card.recommendedAction ?? "").includes("archive") ? "archived" : "done", detail: `Processed approved action: ${card.recommendedAction}` });
    card.gateTrace = trace;
    emitSupportEvent({ type: "support_review.action_done", runId: run.reviewRunId, cardId: card.cardId, action: actionKind, status: card.status });
  }
  run.status = approvedCards.length > 0 ? "active_triage_updated" : run.status;
  writeFileSync(runPath(run.reviewRunId), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  rebuildActiveTriage(run);
  emitSupportEvent({ type: "support_review.actions_applied", runId: run.reviewRunId, count: approvedCards.length });
  return { applied: approvedCards.length, archived: archiveCards.length, noAction: approvedCards.length - archiveCards.length };
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as { runId?: string; mode?: "send" | "apply_done" | "all" };
  if (!body.runId) return json({ ok: false, error: "missing runId" }, { status: 400 });
  const mode = body.mode ?? "send";
  const run = loadRun(body.runId);
  if (!run) return json({ ok: false, error: "run not found" }, { status: 404 });
  const cards = run.cards ?? [];
  const approvals = await latestApprovals(cards.map((card) => card.cardId));
  const approvedSendCards = cards.filter((card) => approvals.has(card.cardId) && card.draftHtml && card.recommendedAction === "reply" && !card.sentReceipt && !String(card.status ?? "").startsWith("sent_"));
  const approvedDoneCards = cards.filter((card) => approvals.has(card.cardId) && !card.draftHtml && !card.archiveReceipt && !String(card.status ?? "").startsWith("archived_") && (String(card.recommendedAction ?? "").includes("no_reply") || String(card.recommendedAction ?? "").includes("no_action") || String(card.recommendedAction ?? "").includes("archive")));
  const approvedCards = mode === "send" ? approvedSendCards : mode === "apply_done" ? approvedDoneCards : [...approvedSendCards, ...approvedDoneCards];
  emitSupportEvent({ type: "support_review.batch_requested", runId: body.runId, mode, count: approvedCards.length });
  if (mode === "apply_done") {
    const applied = await applyApprovedDone(run, approvedCards);
    return json({ ok: true, status: "applied", runId: body.runId, mode, queued: 0, ...applied });
  }
  if (mode === "send") {
    const sent = await sendApprovedReplies(run, approvedCards);
    return json({ ok: true, status: "sent", runId: body.runId, mode, queued: 0, ...sent });
  }
  const urls = bridgeReviewBatchesUrls();
  const batch = {
    type: "support-review-send-approved-batch",
    product: "aihero",
    documentId: body.runId,
    comments: approvedCards.map((card) => ({ id: `${card.draftHtml ? "send" : "apply"}-${card.cardId}-${Date.now()}`, kind: card.draftHtml ? "send_approved" : "apply_approved_action", blockIds: [card.cardId], comment: card.draftHtml ? "Send exact approved draftHtml only." : `Apply approved non-reply action: ${card.recommendedAction}`, currentText: card.draftHtml ?? "", conversationId: card.conversationId, subject: card.subject, recommendedAction: card.recommendedAction })),
    expectedAgentAction: [
      "Use /skill:aih-triage and delegate to aih-approved-reply-sender if available.",
      "For each approved reply card, send only the exact approved draftHtml to the matching Front conversation.",
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
  for (const card of approvedCards) await writeReceipt(card.cardId, card.draftHtml ? "send_approved" : "apply_approved_action", card.draftHtml ? "Queued in approved batch for exact draftHtml send." : `Queued approved non-reply action: ${card.recommendedAction}.`, { runId: body.runId, cardId: card.cardId, mode, bridgePayload: payload, deliveredUrl });
  return json({ ok: true, status: "sent_to_pi", runId: body.runId, mode, queued: approvedCards.length, deliveredUrl, payload });
};
