import { json, type RequestHandler } from "@sveltejs/kit";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { workspaceRoot } from "$lib/server/brain-pipeline";

type SupportReviewRun = {
  reviewRunId: string;
  cards?: Array<{ cardId: string; [key: string]: unknown }>;
};

function runsDir() {
  return join(workspaceRoot(), ".brain", "data", "support-review-runs");
}

function feedbackDir() {
  return join(workspaceRoot(), ".brain", "data", "operator-feedback");
}

function supportReviewDbPath() {
  return join(workspaceRoot(), ".brain", "data", "support-review.db");
}

async function writeFeedbackToLibsql(receipt: Record<string, unknown>) {
  const client = createClient({ url: `file:${supportReviewDbPath()}` });
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

export const GET: RequestHandler = ({ url }) => {
  const cardId = url.searchParams.get("cardId");
  if (!cardId) return json({ ok: false, error: "missing cardId" }, { status: 400 });

  for (const run of loadRuns()) {
    const card = run.cards?.find((item) => item.cardId === cardId);
    if (card) return json({ ok: true, reviewRunId: run.reviewRunId, card });
  }

  return json({ ok: false, error: "card not found", cardId }, { status: 404 });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as { cardId?: string; feedback?: string; verdict?: string };
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
  return json({ ok: true, receipt, sqlitePath: supportReviewDbPath() });
};
