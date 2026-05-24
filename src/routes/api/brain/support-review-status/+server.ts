import { json, type RequestHandler } from "@sveltejs/kit";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { workspaceRoot } from "$lib/server/brain-pipeline";

type Card = { cardId: string; draftHtml?: string; draftSource?: string; draftVoice?: string; recommendedAction?: string; status?: string; bucket?: "active" | "processing" | "revised_ready" | "done"; sentReceipt?: unknown; archiveReceipt?: unknown; applyReceipt?: unknown };
type Run = { reviewRunId: string; status?: string; cards?: Card[] };

function runsDir() { return join(workspaceRoot(), ".brain", "data", "support-review-runs"); }
function dbPath() { return join(workspaceRoot(), ".brain", "data", "support-review.db"); }

function latestRun(): Run | null {
  const dir = runsDir();
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((file) => file.endsWith(".json")).map((file) => ({ file, path: join(dir, file) }));
  files.sort((a, b) => b.file.localeCompare(a.file));
  const match = files[0];
  return match ? JSON.parse(readFileSync(match.path, "utf8")) as Run : null;
}

async function feedbackCounts(cardIds: string[]) {
  if (!existsSync(dbPath()) || cardIds.length === 0) return { approved: 0, unapproved: 0, feedbackSent: 0, sendQueued: 0, archiveQueued: 0 };
  const client = createClient({ url: `file:${dbPath()}` });
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
  const result = await client.execute(`select card_id, verdict from operator_feedback order by captured_at asc, id asc`);
  client.close();
  const cardSet = new Set(cardIds);
  const latestApproval = new Map<string, string>();
  let feedbackSent = 0;
  let sendQueued = 0;
  let archiveQueued = 0;
  for (const row of result.rows) {
    const cardId = String(row.card_id);
    if (!cardSet.has(cardId)) continue;
    const verdict = String(row.verdict);
    if (["approve", "unapprove", "send_approved", "send_approved_archive", "archive_approved", "action_done", "send_approved_done"].includes(verdict)) latestApproval.set(cardId, verdict);
    if (verdict === "rewrite" || verdict === "generate" || verdict === "comment") feedbackSent += 1;

  }
  return {
    approved: [...latestApproval.values()].filter((value) => value === "approve").length,
    unapproved: [...latestApproval.values()].filter((value) => value === "unapprove").length,
    sent: [...latestApproval.values()].filter((value) => value === "send_approved" || value === "send_approved_archive").length,
    archived: [...latestApproval.values()].filter((value) => value === "archive_approved").length,
    feedbackSent,
    sendQueued: [...latestApproval.values()].filter((value) => value === "send_approved").length,
    archiveQueued: [...latestApproval.values()].filter((value) => value === "send_approved_archive").length,
    latestApproval,
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const runId = url.searchParams.get("runId");
  const dir = runsDir();
  if (!existsSync(dir)) return json({ ok: true, run: null });
  let run: Run | null = null;
  if (runId) {
    const path = join(dir, `${runId}.json`);
    if (existsSync(path)) run = JSON.parse(readFileSync(path, "utf8")) as Run;
  } else {
    run = latestRun();
  }
  if (!run) return json({ ok: false, error: "run not found" }, { status: 404 });
  const cards = run.cards ?? [];
  const counts = await feedbackCounts(cards.map((card) => card.cardId));
  const latestApproval = counts.latestApproval as Map<string, string>;
  const isSent = (card: Card) => Boolean(card.sentReceipt || card.status?.startsWith("sent_") || ["send_approved", "send_approved_archive", "send_approved_done"].includes(latestApproval.get(card.cardId) ?? ""));
  const isArchived = (card: Card) => Boolean(card.archiveReceipt || card.status?.startsWith("archived_") || latestApproval.get(card.cardId) === "archive_approved");
  const isDoneNoAction = (card: Card) => Boolean(card.status === "approved_no_action_done" || latestApproval.get(card.cardId) === "action_done");
  const isApproved = (card: Card) => latestApproval.get(card.cardId) === "approve";
  const isNonReplyAction = (card: Card) => !card.draftHtml && (card.recommendedAction === "archive" || card.recommendedAction?.includes("archive") || card.recommendedAction?.includes("no_reply") || card.recommendedAction?.includes("no_action") || card.status?.includes("no_draft"));
  const replyDraftsReady = cards.filter((card) => card.draftHtml && card.recommendedAction === "reply" && !isSent(card)).length;
  const noReplyReady = cards.filter((card) => isNonReplyAction(card) && !isArchived(card) && !isDoneNoAction(card)).length;
  const actionableSendApproved = cards.filter((card) => isApproved(card) && card.draftHtml && card.recommendedAction === "reply" && !isSent(card)).length;
  const actionableApplyApproved = cards.filter((card) => isApproved(card) && isNonReplyAction(card) && !isArchived(card) && !isDoneNoAction(card)).length;
  const sent = cards.filter(isSent).length;
  const archived = cards.filter(isArchived).length;
  const doneNoAction = cards.filter(isDoneNoAction).length;
  const pending = cards.length - replyDraftsReady - noReplyReady - sent - archived - doneNoAction;
  return json({
    ok: true,
    run: { reviewRunId: run.reviewRunId, status: run.status, cards: cards.length },
    counts: { replyDraftsReady, noReplyReady, pending: Math.max(0, pending), ...counts, sent, archived, doneNoAction, actionableSendApproved, actionableApplyApproved, latestApproval: undefined },
  });
};
