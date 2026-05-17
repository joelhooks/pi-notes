import { json, type RequestHandler } from "@sveltejs/kit";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { workspaceRoot } from "$lib/server/brain-pipeline";

type SupportReviewCard = { cardId: string; draft?: string; draftMarkdown?: string; draftHtml?: string; [key: string]: unknown };

type SupportReviewRun = {
  reviewRunId: string;
  cards?: SupportReviewCard[];
};

function renderDraftMarkdown(markdown: string) {
  const raw = marked.parse(markdown, { async: false, breaks: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: ["p", "a", "strong", "em", "ul", "ol", "li", "code", "br"],
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function hydrateDraft(card: SupportReviewCard) {
  if (!card.draftMarkdown) return card;
  const rendered = renderDraftMarkdown(card.draftMarkdown);
  return { ...card, draftHtml: rendered, draft: card.draftHtml ?? rendered };
}

function runsDir() {
  return join(workspaceRoot(), ".brain", "data", "support-review-runs");
}

function feedbackDir() {
  return join(workspaceRoot(), ".brain", "data", "operator-feedback");
}

function supportReviewDbPath() {
  return join(workspaceRoot(), ".brain", "data", "support-review.db");
}

function bridgeStatusPath() {
  return join(workspaceRoot(), ".pi", "notes-bridge", "status.json");
}

function bridgeReviewBatchesUrl() {
  const path = bridgeStatusPath();
  if (!existsSync(path)) return null;
  const status = JSON.parse(readFileSync(path, "utf8")) as { bridgeUrl?: string; reviewBatchesUrl?: string };
  return status.reviewBatchesUrl ?? (status.bridgeUrl ? `${status.bridgeUrl.replace(/\/$/, "")}/review-batches` : null);
}

async function sendPiDraftBatch(body: { cardId: string; feedback: string; verdict?: string; currentDraft?: string; conversationId?: string; subject?: string; approvedDraftHtml?: string }) {
  const url = bridgeReviewBatchesUrl();
  if (!url) return { ok: false, status: "bridge_unavailable" };
  const isSend = body.verdict === "send_approved" || body.verdict === "send_approved_archive";
  const batch = {
    type: isSend ? "support-review-send-approved" : body.verdict === "generate" ? "support-review-generate-draft" : "support-review-rewrite",
    product: "aihero",
    documentId: body.cardId,
    comments: [
      {
        id: `rewrite-${body.cardId}-${Date.now()}`,
        kind: body.verdict ?? "rewrite",
        blockIds: [body.cardId],
        comment: body.feedback,
        currentText: body.currentDraft ?? "",
      },
    ],
    expectedAgentAction: [
      isSend
        ? "Use /skill:aih-triage and delegate to aih-approved-reply-sender if available. Send the exact approvedDraftHtml for this SupportReplyCard only, as Joel/current operator, never as Matt."
        : "Use a real Pi agent turn from /Users/joel/Code/badass-courses/aihero-support to generate or rewrite this SupportReplyCard draft.",
      "Do not use deterministic templates, if/else routing, canned reply stubs, or generic LLM copy.",
      "Follow /skill:aih-support-voice and /skill:joel-writing-style as light support voice.",
      "Before drafting, recall AI Hero support memory, inspect the card data, use the full Front thread context present in the run, perform/verify the read-only Kit subscriber lookup, and search data/reference-corpus/reference-corpus.sqlite for matching public resources.",
      "Write 1 to 4 short HTML <p> paragraphs in current operator voice, not Matt's voice, no signature, no em dashes, no consultant phrasing, no support slop.",
      isSend
        ? (body.verdict === "send_approved_archive" ? "Customer-visible action is explicitly approved for this card: send exact approvedDraftHtml, then archive only this Front conversation after successful send. Do not tag, assign, write Kit, write Contact State, or alter other conversations." : "Customer-visible action is explicitly approved for this card: send exact approvedDraftHtml only. Do not archive, tag, assign, write Kit, write Contact State, or alter other conversations.")
        : "Do not send, queue, archive, tag, assign, write Kit, write Contact State, or mutate any customer-visible system.",
      "Update only the matching card in .brain/data/support-review-runs/*.json so the browser refreshes with the revised draft.",
      "Set draftSource to pi_agent_sop, draftVoice to sop_passed only if the SOP was actually followed, add corpusUsed, kitContextSummary, and generationReceipt with exact commands/sources used and generatedAt.",
      isSend ? `Approved HTML to send exactly:\n${body.approvedDraftHtml ?? body.currentDraft ?? ""}` : "Keep sendGate blocked and preserve the approval flow for Joel to approve after review.",
      body.conversationId ? `Conversation: ${body.conversationId}` : "",
      body.subject ? `Subject: ${body.subject}` : "",
      body.feedback ? `Joel feedback/request: ${body.feedback}` : "",
    ].filter(Boolean).join("\n"),
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(batch),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.ok ? "sent_to_pi" : "bridge_failed", payload };
}

async function ensureFeedbackTable(client: ReturnType<typeof createClient>) {
  await client.execute(`
    create table if not exists operator_feedback (
      id integer primary key autoincrement,
      card_id text not null,
      verdict text not null,
      feedback text not null,
      source text not null,
      captured_at text not null,
      payload_json text not null
    )
  `);
}

async function latestApprovalForCard(cardId: string) {
  const dbPath = supportReviewDbPath();
  if (!existsSync(dbPath)) return null;
  const client = createClient({ url: `file:${dbPath}` });
  await ensureFeedbackTable(client);
  const result = await client.execute({
    sql: `
      select verdict, feedback, captured_at, payload_json
      from operator_feedback
      where card_id = ? and verdict in ('approve', 'unapprove')
      order by captured_at desc, id desc
      limit 1
    `,
    args: [cardId],
  });
  client.close();
  const row = result.rows[0];
  if (!row || String(row.verdict) === "unapprove") return null;
  return {
    verdict: String(row.verdict),
    feedback: String(row.feedback),
    capturedAt: String(row.captured_at),
    payload: row.payload_json ? JSON.parse(String(row.payload_json)) : null,
  };
}

async function writeFeedbackToLibsql(receipt: Record<string, unknown>) {
  const client = createClient({ url: `file:${supportReviewDbPath()}` });
  await ensureFeedbackTable(client);
  await client.execute({
    sql: `
      insert into operator_feedback (card_id, verdict, feedback, source, captured_at, payload_json)
      values (?, ?, ?, ?, ?, ?)
    `,
    args: [
      String(receipt.cardId),
      String(receipt.verdict ?? "comment"),
      String(receipt.feedback),
      String(receipt.source),
      String(receipt.capturedAt),
      JSON.stringify(receipt),
    ],
  });
  client.close();
}

function loadRuns(): SupportReviewRun[] {
  const dir = runsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as SupportReviewRun);
}

export const GET: RequestHandler = async ({ url }) => {
  const cardId = url.searchParams.get("cardId");
  if (!cardId) return json({ ok: false, error: "missing cardId" }, { status: 400 });

  for (const run of loadRuns()) {
    const card = run.cards?.find((item) => item.cardId === cardId);
    if (card) {
      const approval = await latestApprovalForCard(cardId);
      return json({ ok: true, reviewRunId: run.reviewRunId, card: { ...hydrateDraft(card), approval } });
    }
  }

  return json({ ok: false, error: "card not found", cardId }, { status: 404 });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as { cardId?: string; feedback?: string; verdict?: string; currentDraft?: string; conversationId?: string; subject?: string; approvedDraftHtml?: string };
  if (!body.cardId || !body.feedback?.trim()) return json({ ok: false, error: "missing cardId or feedback" }, { status: 400 });

  mkdirSync(feedbackDir(), { recursive: true });
  mkdirSync(join(workspaceRoot(), ".brain", "data"), { recursive: true });
  const receipt = {
    ...body,
    verdict: body.verdict ?? "comment",
    source: "pi-notes.support-review-card",
    capturedAt: new Date().toISOString(),
  };
  await writeFeedbackToLibsql(receipt);
  appendFileSync(join(feedbackDir(), "operator-feedback.jsonl"), `${JSON.stringify(receipt)}\n`, "utf8");
  const piDraftRequest = ["rewrite", "generate", "send_approved", "send_approved_archive"].includes(String(body.verdict))
    ? await sendPiDraftBatch({ ...body, cardId: body.cardId, feedback: body.feedback })
    : null;
  return json({ ok: true, receipt, piDraftRequest, sqlitePath: supportReviewDbPath() });
};
