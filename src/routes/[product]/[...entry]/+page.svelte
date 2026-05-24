<script lang="ts">
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { ChatFeedbackIcon, CheckmarkCircle02Icon, FileEditIcon, InboxUploadIcon } from "@hugeicons/core-free-icons";
  import { invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { PageProps } from "./$types";
  import BrainDocument from "./BrainDocument.svelte";

  let { data }: PageProps = $props();

  type SelectedBlock = {
    documentId: string;
    sourcePath: string;
    blockId: string;
    blockKind: string;
    text: string;
    hash: string;
  };

  type QueuedComment = {
    id: string;
    kind: "comment" | "rewrite";
    blockIds: string[];
    blockKind: string;
    currentText: string;
    comment: string;
    documentHash: string;
  };

  let selected = $state<SelectedBlock[]>([]);
  let comment = $state("");
  let queue = $state<QueuedComment[]>([]);
  let receipt = $state("");
  let sending = $state(false);
  let bridgeEvent = $state("not connected");
  let agentActivity = $state<Array<{ id: string; label: string; detail: string; ts: number; kind: string }>>([]);
  let supportReviewStatus = $state<{ run?: { reviewRunId: string; status?: string; cards: number } | null; counts?: Record<string, number> } | null>(null);
  let sendingApprovedBatch = $state(false);
  let approvedBatchReceipt = $state("");
  let pendingTriageReload: ReturnType<typeof setTimeout> | null = null;
  let sessionState = $state<{
    connected: boolean;
    session?: {
      sessionFile?: string | null;
      route?: string;
      url?: string;
      preferredUrl?: string;
      eventsUrl?: string;
      reviewBatchesUrl?: string;
      connectedAt?: string;
    };
    bridge?: { state?: string; url?: string; preferredUrl?: string; eventsUrl?: string; reviewBatchesUrl?: string; updatedAt?: string };
  }>({ connected: false });

  const entries = $derived((data.entries ?? []) as Array<{ id: string; title: string; sourcePath: string; blockCount: number; para: string; status?: string }>);
  const paraSections = $derived(["Projects", "Areas", "Resources", "Archives"].map((name) => ({ name, entries: entries.filter((entry) => entry.para === name) })).filter((section) => section.entries.length > 0));
  const documents = $derived((data.documents ?? []) as Array<{ id: string; title: string; sourcePath: string; blocks: Array<{ id: string; kind: string; text: string; html: string; hash: string }> }>);
  const hasDocuments = $derived(documents.length > 0);
  const selectedIds = $derived(new Set(selected.map((block) => block.blockId)));
  const canQueue = $derived(comment.trim().length > 0);
  const canSend = $derived((queue.length > 0 || comment.trim().length > 0) && !sending);
  const bridgeState = $derived(sessionState.bridge?.state ?? "idle");
  const activeAgentWork = $derived(agentActivity.some((item) => ["pi_bridge.send.started", "pi_bridge.received", "pi_bridge.enqueue"].includes(item.kind)) || bridgeState === "sending");
  function supportRunIdFromDocument(document: { sourcePath: string; blocks: Array<{ text: string }> } | undefined) {
    if (!document) return null;
    const fromPath = document.sourcePath.match(/(sr_[^/.]+)\.svx$/)?.[1];
    if (fromPath) return fromPath;
    const joinedText = document.blocks.map((block) => block.text).join("\n");
    return joinedText.match(/Run:\s*`?(sr_[A-Za-z0-9_]+)`?/)?.[1] ?? null;
  }
  const currentSupportRunId = $derived(supportRunIdFromDocument(documents[0]));

  function pushActivity(kind: string, detail: string, data: unknown = {}) {
    const ts = Date.now();
    agentActivity = [{ id: `${kind}-${ts}-${Math.random().toString(16).slice(2)}`, kind, label: kind.replace(/^pi_bridge\./, ""), detail, ts }, ...agentActivity].slice(0, 8);
    bridgeEvent = `${kind} ${JSON.stringify(data).slice(0, 180)}`;
  }

  function toggleBlock(block: SelectedBlock, event: MouseEvent | KeyboardEvent) {
    const multi = event.metaKey || event.ctrlKey || event.shiftKey;
    const alreadySelected = selectedIds.has(block.blockId);
    if (!multi) {
      selected = alreadySelected ? [] : [block];
      return;
    }
    selected = alreadySelected
      ? selected.filter((item) => item.blockId !== block.blockId)
      : [...selected, block];
  }

  function markRenderedSelection() {
    if (typeof document === "undefined") return;
    const ids = new Set(selected.map((block) => block.blockId));
    document.querySelectorAll("[data-selectable-block]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.dataset.selected = ids.has(element.dataset.blockId ?? "") ? "true" : "false";
    });
  }

  function hashText(value: string) {
    let result = 0;
    for (const char of value) result = Math.imul(31, result) + char.charCodeAt(0) | 0;
    return Math.abs(result).toString(16);
  }

  function selectRenderedBlock(document: { id: string; sourcePath: string }, event: MouseEvent | KeyboardEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("button,a,input,textarea,select,label,[data-no-block-select]")) return;
    const block = target?.closest("[data-selectable-block]");
    if (!(block instanceof HTMLElement)) return;
    const text = block.innerText.trim();
    if (!text) return;
    const kind = block.dataset.blockKind ?? block.tagName.toLowerCase();
    const blockId = block.dataset.blockId ?? `${document.id}:rendered-${hashText(`${kind}:${text}`)}`;
    toggleBlock({
      documentId: document.id,
      sourcePath: document.sourcePath,
      blockId,
      blockKind: kind,
      text,
      hash: hashText(`${kind}:${text}`),
    }, event);
  }

  function makeComment(id: string): QueuedComment {
    const documentHash = selected.map((block) => block.hash).join(":");
    return {
      id,
      kind: "comment",
      blockIds: selected.map((block) => block.blockId),
      blockKind: selected.length > 0 ? [...new Set(selected.map((block) => block.blockKind))].join("+") : "note",
      currentText: selected.length > 0 ? selected.map((block) => `[${block.blockId}]\n${block.text}`).join("\n\n") : "No block selected; comment applies to the current note/page.",
      comment: comment.trim(),
      documentHash,
    };
  }

  function addComment() {
    if (!canQueue) return;
    queue = [...queue, makeComment(`c${queue.length + 1}`)];
    selected = [];
    comment = "";
    receipt = `Staged c${queue.length}: still only in this browser.`;
  }

  async function refreshSession() {
    const response = await fetch("/api/session");
    sessionState = await response.json();
  }

  async function refreshSupportReviewStatus() {
    const response = await fetch(`/api/brain/support-review-status${currentSupportRunId ? `?runId=${encodeURIComponent(currentSupportRunId)}` : ""}`);
    const payload = await response.json();
    if (payload.ok) supportReviewStatus = payload;
  }

  function firstExpandedCardElement() {
    if (typeof document === "undefined") return null;
    const cards = [...document.querySelectorAll<HTMLElement>(".aih-support-reply-card")];
    return cards.find((card) => !card.querySelector(".folded-state")) ?? null;
  }

  function placeRevisedCardNext(cardId: string) {
    if (typeof document === "undefined") return;
    const revised = document.querySelector<HTMLElement>(`.aih-support-reply-card[data-card-id="${CSS.escape(cardId)}"]`);
    const current = firstExpandedCardElement();
    if (!revised || !current || revised === current) return;
    const afterCurrent = current.nextElementSibling;
    if (afterCurrent === revised) return;
    current.parentElement?.insertBefore(revised, afterCurrent);
  }

  function scheduleTriageReload(delay = 2000, revisedCardId?: string) {
    if (pendingTriageReload) clearTimeout(pendingTriageReload);
    pendingTriageReload = setTimeout(() => {
      void invalidateAll().then(() => {
        if (revisedCardId) setTimeout(() => placeRevisedCardNext(revisedCardId), 0);
      });
      pendingTriageReload = null;
    }, delay);
  }

  function nextSupportActionMode() {
    if ((supportReviewStatus?.counts?.actionableSendApproved ?? 0) > 0) return "send" as const;
    if ((supportReviewStatus?.counts?.actionableApplyApproved ?? 0) > 0) return "apply_done" as const;
    return null;
  }

  function nextSupportActionLabel() {
    const sendCount = supportReviewStatus?.counts?.actionableSendApproved ?? 0;
    const applyCount = supportReviewStatus?.counts?.actionableApplyApproved ?? 0;
    if (sendCount > 0) return `Send approved replies (${sendCount})`;
    if (applyCount > 0) return `Apply no-action/archive (${applyCount})`;
    return "Review cards first";
  }

  async function processNextSupportAction() {
    const mode = nextSupportActionMode();
    if (!mode) return;
    await sendApprovedBatch(mode);
  }

  async function sendApprovedBatch(mode: "send" | "apply_done") {
    if (!currentSupportRunId || sendingApprovedBatch) return;
    sendingApprovedBatch = true;
    approvedBatchReceipt = "Queueing approved batch...";
    try {
      const response = await fetch("/api/brain/support-review-batch-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: currentSupportRunId, mode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "failed to queue batch");
      approvedBatchReceipt = payload.status === "applied"
        ? `Applied ${payload.applied} approved actions. Archived ${payload.archived}.`
        : payload.status === "sent"
          ? `Sent ${payload.sent} approved replies. ${payload.failed ? `${payload.failed} failed.` : ""}`
          : `Queued ${payload.queued} ${mode === "send" ? "approved replies" : "approved actions"} to Pi.`;
      if (payload.status === "applied" || payload.status === "sent") scheduleTriageReload();
      void refreshSupportReviewStatus();
    } catch (error) {
      approvedBatchReceipt = error instanceof Error ? error.message : "failed to queue batch";
    } finally {
      sendingApprovedBatch = false;
    }
  }

  $effect(() => {
    markRenderedSelection();
  });

  $effect(() => {
    void refreshSession();
    void refreshSupportReviewStatus();
    const interval = setInterval(() => { void refreshSession(); void refreshSupportReviewStatus(); }, 3000);
    return () => clearInterval(interval);
  });

  $effect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("ready", (event) => pushActivity("sse.ready", "Live agent stream connected", event.data));
    source.addEventListener("bridge", (event) => {
      pushActivity("bridge.status", "Bridge status changed", event.data);
      void refreshSession();
    });
    source.addEventListener("agent", (event) => {
      const payload = JSON.parse(event.data) as { event?: { event?: string; data?: { batchId?: string; status?: string; file?: string; error?: string } } };
      const item = payload.event;
      pushActivity(item?.event ?? "agent.event", item?.data?.batchId ?? item?.data?.file ?? item?.data?.status ?? item?.data?.error ?? "agent activity", payload);
      void refreshSession();
    });
    source.addEventListener("changed", (event) => {
      const payload = JSON.parse(event.data) as { path?: string };
      pushActivity("brain.changed", "Review data changed", event.data);
      void refreshSession();
      void refreshSupportReviewStatus();
      if (payload.path?.endsWith("triage.svx") || payload.path?.includes("support-review-runs/")) scheduleTriageReload();
    });
    source.addEventListener("support_review", (event) => {
      pushActivity("support.review", "Support review updated", event.data);
      void refreshSupportReviewStatus();
      const payload = JSON.parse(event.data) as { event?: { type?: string; cardId?: string; status?: string } };
      const type = payload.event?.type ?? "";
      const cardId = payload.event?.cardId;
      if (type.includes("action_done") && cardId) {
        window.dispatchEvent(new CustomEvent("support-review-card-completed", { detail: { cardId, action: payload.event?.status ?? "done", capturedAt: new Date().toISOString() } }));
        scheduleTriageReload();
      } else if ((type.includes("card_updated") || type.includes("revision")) && cardId) scheduleTriageReload(0, cardId);
      else if (type.includes("triage_rebuilt") || type.includes("actions_applied")) scheduleTriageReload();
    });
    source.onerror = () => (bridgeEvent = "SSE disconnected");
    return () => source.close();
  });

  function createBatchId() {
    const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
    const suffix = crypto.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10);
    return `batch_${stamp}_${suffix}`;
  }

  async function sendBatch() {
    if (!canSend) return;
    const comments = comment.trim().length > 0 ? [...queue, makeComment(`c${queue.length + 1}`)] : queue;
    const batchId = createBatchId();
    const batch = {
      batchId,
      type: "pi_notes_dogfood_review_batch",
      adapterId: "pi-notes.brain-docs",
      product: data.product,
      documentId: documents[0]?.id ?? "pi-notes-brain",
      comments,
      globalInstruction: "Use this feedback to shape pi-notes itself. Browser delivered the batch to Pi; the Document Host keeps a local receipt only.",
      expectedAgentAction: "Handle the review feedback, update pi-notes docs or code, write the required Review Receipt, and report handled/partial/unhandled comment ids.",
    };
    sending = true;
    receipt = `Sending feedback ${batchId}...`;
    try {
      const bridgeUrl = sessionState.session?.reviewBatchesUrl ?? sessionState.bridge?.reviewBatchesUrl;
      if (!bridgeUrl) throw new Error("missing active Pi bridge reviewBatchesUrl");
      const bridgeResponse = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
      });
      const bridgeResult = await bridgeResponse.json().catch(() => ({}));
      if (!bridgeResponse.ok || !bridgeResult.ok) throw new Error(bridgeResult.error ?? "bridge delivery failed");

      const receiptResponse = await fetch("/api/review-batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...batch, deliveredViaBridge: true }),
      });
      const receiptResult = await receiptResponse.json().catch(() => ({}));
      receipt = `Sent ${comments.length} feedback item(s) to Pi · ${bridgeResult.batchId ?? batchId}${receiptResult.savedPath ? ` · saved ${receiptResult.savedPath}` : ""}`;
      queue = [];
      comment = "";
      selected = [];
    } catch (error) {
      receipt = `Send failed before Pi delivery · ${batchId} · ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      sending = false;
    }
  }
</script>

<svelte:head>
  <title>{data.product} · pi-notes</title>
</svelte:head>

<main>
  <header class="topbar compact">
    <a class="crumb" href={resolve("/[product]", { product: "notes" })}>Notes</a>
    {#if documents.length}
      <span class="crumb-title">{documents[0]?.title}</span>
    {:else}
      <span class="crumb-title">{entries.length} entries</span>
    {/if}
    <span class="agent {activeAgentWork ? 'waiting' : bridgeState === 'sent' ? 'done' : ''}">
      {activeAgentWork ? "Agents working" : bridgeState === "sent" ? "Sent" : sessionState.connected ? "Ready" : "Offline"}
    </span>
  </header>

  <section class="layout">
    <div class="email-stack" aria-label="Review documents">
      {#if entries.length > 0}
        <article class="kit-email">
          <button type="button" class="email-chrome-block" aria-label="Brain index">
            <span class="block-text"><span>.brain</span><strong>Brain entries</strong><code>{entries.length} routes</code></span>
          </button>
          <div class="entry-list">
            {#each paraSections as section (section.name)}
              <section class="para-section">
                <h2>{section.name}</h2>
                {#each section.entries as entry (entry.id)}
                  <a class="entry-card" href={resolve("/[product]/[...entry]", { product: data.product, entry: entry.id })}>
                    <strong>{entry.title}</strong>
                    <span>{entry.sourcePath} · {entry.blockCount} blocks {entry.status ? `· ${entry.status}` : ""}</span>
                  </a>
                {/each}
              </section>
            {/each}
          </div>
        </article>
      {:else if hasDocuments}
        {#each documents as document (document.id)}
          <article class="kit-email">
            <button
              type="button"
              class="email-chrome-block"
              aria-label={`Document ${document.title}`}
            >
              <span class="block-text"><span>{document.sourcePath}</span><strong>{document.title}</strong><code>{document.blocks.length} blocks</code></span>
            </button>

            <div
              class="email-body mdsvex-body"
              role="button"
              tabindex="0"
              aria-label={`Select feedback blocks in ${document.title}`}
              onclick={(event) => selectRenderedBlock(document, event)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") selectRenderedBlock(document, event);
              }}
            >
              <BrainDocument entry={document.id} fallbackBlocks={document.blocks} />
            </div>
          </article>
        {/each}
      {:else}
        <article class="kit-email loading"><h2>No Brain entries yet</h2><p>This namespace is ready for product-scoped review documents.</p></article>
      {/if}
    </div>

    <aside class="sidebar">
      <div class="lane-head">
        <div>
          <p class="eyebrow">Action lane</p>
          <h2>Review feedback</h2>
        </div>
        <span class="lane-status {bridgeState === 'sending' ? 'waiting' : ''}">{sending ? "saving" : bridgeState}</span>
      </div>

      {#if supportReviewStatus?.run}
        <section class="lane-section support-review-status">
          <p class="section-label"><span>◆</span> Support sweep <em>{supportReviewStatus.run.status}</em></p>
          <p><strong>{supportReviewStatus.run.cards}</strong> cards · <code>{supportReviewStatus.run.reviewRunId}</code></p>
          <div class="status-grid">
            <span><strong>{supportReviewStatus.counts?.replyDraftsReady ?? 0}</strong><em>drafts</em></span>
            <span><strong>{supportReviewStatus.counts?.noReplyReady ?? 0}</strong><em>no-reply</em></span>
            <span><strong>{supportReviewStatus.counts?.pending ?? 0}</strong><em>pending</em></span>
            <span><strong>{supportReviewStatus.counts?.approved ?? 0}</strong><em>approved</em></span>
            <span><strong>{supportReviewStatus.counts?.sent ?? 0}</strong><em>sent</em></span>
            <span><strong>{supportReviewStatus.counts?.archived ?? 0}</strong><em>archived</em></span>
            <span><strong>{supportReviewStatus.counts?.feedbackSent ?? 0}</strong><em>feedback</em></span>
            <span><strong>{supportReviewStatus.counts?.sendQueued ?? 0}</strong><em>send queued</em></span>
            <span><strong>{supportReviewStatus.counts?.archiveQueued ?? 0}</strong><em>archive queued</em></span>
          </div>
          <div class="batch-actions">
            <button class="batch-send" type="button" onclick={processNextSupportAction} disabled={sendingApprovedBatch || !nextSupportActionMode()}>{sendingApprovedBatch ? "Working..." : nextSupportActionLabel()}</button>
          </div>
          {#if approvedBatchReceipt}<p class="send-receipt">{approvedBatchReceipt}</p>{/if}
        </section>
      {/if}

      <section class="lane-section roundtrip agent-work">
        <p class="section-label"><span>●</span> Agent loop <em>{activeAgentWork ? "running" : "live"}</em></p>
        <p><strong>Session</strong> {sessionState.connected ? "connected" : "not connected"}</p>
        <p><strong>Bridge</strong> {bridgeState}</p>
        <p title={bridgeEvent}><strong>SSE</strong> {bridgeEvent}</p>
        {#if sessionState.session?.url}<p><code>{sessionState.session.url}</code></p>{/if}
        <div class="activity-list">
          {#each agentActivity as item (item.id)}
            <div class="activity {item.kind.includes('failed') ? 'bad' : item.kind.includes('sent') || item.kind.includes('changed') ? 'good' : ''}">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          {:else}
            <p class="muted">Waiting for bridge events. Generate with Pi will show here as soon as the batch hits the session.</p>
          {/each}
        </div>
      </section>

      <section class="lane-section active-section">
        <p class="section-label"><span><HugeiconsIcon icon={FileEditIcon} size={13} /></span> Feedback context <em>{selected.length}</em></p>
        {#if selected.length}
          <button type="button" class="clear-selection" onclick={() => selected = []}>Clear selection</button>
        {/if}
        {#if selected.length}
          <div class="selected-box">
            {#each selected as block (block.blockId)}
              <p><span>{block.blockKind}</span>{block.text.slice(0, 96)}{block.text.length > 96 ? "…" : ""}</p>
            {/each}
          </div>
        {:else}
          <p class="muted">Optional: click a block to attach context. Feedback can also apply to the whole note.</p>
        {/if}

        <textarea placeholder="Tell the agent what to change..." bind:value={comment}></textarea>

        <div class="actions">
          <button type="button" class="primary" disabled={!canSend} onclick={sendBatch}>
            <HugeiconsIcon icon={ChatFeedbackIcon} size={16} />
            {sending ? "Sending..." : "Send to Pi"}
          </button>
          <button type="button" class="secondary" disabled={!canQueue} onclick={addComment} title="Stage this in the browser instead of sending now">
            <HugeiconsIcon icon={InboxUploadIcon} size={15} />
            Stage
          </button>
        </div>
      </section>

      <section class="lane-section">
        <p class="section-label"><span><HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} /></span> Browser staging <em>{queue.length}</em></p>
        {#if queue.length}
          <div class="queue">
            {#each queue as item (item.id)}
              <div class="queued"><span>{item.id} · {item.blockKind}</span><p>{item.comment}</p></div>
            {/each}
          </div>
        {:else}
          <p class="muted">Nothing staged. Primary action sends straight to Pi.</p>
        {/if}

        {#if queue.length}
          <div class="actions">
            <button type="button" class="primary" disabled={!canSend} onclick={sendBatch}>
              <HugeiconsIcon icon={ChatFeedbackIcon} size={16} />
              {sending ? "Sending..." : "Send staged to Pi"}
            </button>
          </div>
        {/if}
        {#if receipt}<p class="send-receipt">{receipt}</p>{/if}
      </section>

      <section class="lane-section roundtrip">
        <p>Trace: <code>.pi/notes-bridge/events.jsonl</code></p>
        <p>Receipt: <code>.pi/notes-bridge/receipts/&lt;batchId&gt;.json</code></p>
      </section>
    </aside>
  </section>
</main>

<style>
  :global(html) { max-width: 100%; overflow-x: hidden; }
  :global(body) { margin: 0; max-width: 100%; overflow-x: hidden; font-family: Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #24292f; background: #f7f7f5; }
  :global(*) { box-sizing: border-box; }
  :global(button), :global(textarea) { font: inherit; }
  main { min-height: 100vh; max-width: 100vw; overflow-x: hidden; }
  .topbar { display: flex; justify-content: space-between; gap: 24px; padding: 16px 26px 8px; background: #f7f7f5; }
  .topbar.compact { justify-content: flex-start; align-items: center; gap: 10px; padding: 8px 18px 4px; color: #6b7280; font-size: 12px; }
  .crumb { color: #3b4652; text-decoration: none; font-weight: 650; }
  .crumb:hover { text-decoration: underline; text-underline-offset: 3px; }
  .crumb-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .topbar.compact .agent { margin-left: auto; padding: 4px 8px; font-size: 11px; }
  h2 { margin: 0 0 8px; font-size: 16px; }
  .eyebrow { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .11em; color: #6f6b63; font-weight: 650; }
  .muted { color: #6b7280; margin: 4px 0 0; line-height: 1.45; }
  .agent { align-self: start; border: 1px solid #dedbd4; border-radius: 999px; background: #fff; padding: 7px 11px; font-size: 13px; }
  .agent.waiting { background: #fff8e8; border-color: #e8d6a3; }
  .agent.done { background: #f0fdf4; border-color: #bbf7d0; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; padding: 6px 18px 40px; align-items: start; max-width: 100%; overflow-x: hidden; }
  .email-stack { display: grid; gap: 10px; justify-items: center; min-width: 0; max-width: 100%; }
  .kit-email { width: min(100%, 960px); min-width: 0; max-width: 100%; overflow: hidden; background: #fff; border: 1px solid #e4e4e0; box-shadow: 0 10px 28px rgba(31, 41, 55, .045); }
  .email-chrome-block { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 0; border-bottom: 1px solid #ececea; background: #fafafa; color: #6b7280; font-size: 13px; line-height: 1.2; white-space: normal; text-align: left; cursor: default; }
  .block-text { display: flex; align-items: center; gap: 10px; min-width: 0; max-width: 100%; flex: 1; }
  .block-text strong { color: #24292f; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 11px; color: #4b5563; background: #f3f4f6; padding: 2px 6px; border-radius: 999px; overflow-wrap: anywhere; }
  .email-body { padding: 8px 14px 14px; min-width: 0; max-width: 100%; overflow-x: hidden; }
  .entry-list { padding: 10px; display: grid; gap: 10px; }
  .para-section { display: grid; gap: 6px; }
  .para-section h2 { margin: 2px 2px 0; color: #6f6b63; font-size: 11px; text-transform: uppercase; letter-spacing: .11em; }
  .entry-card { display: grid; gap: 4px; border: 1px solid transparent; border-radius: 9px; padding: 10px 12px; color: inherit; text-decoration: none; }
  .entry-card:hover { border-color: #d9d9d6; background: #fafafa; }
  .entry-card strong { font-size: 15px; letter-spacing: -0.01em; }
  .entry-card span { color: #6b7280; font-size: 12px; }
  .mdsvex-body :global(p) { margin: 0.65rem 0; }
  .mdsvex-body :global(h1), .mdsvex-body :global(h2), .mdsvex-body :global(h3) { letter-spacing: -0.015em; line-height: 1.2; }
  .mdsvex-body :global(h1) { font-size: 24px; }
  .mdsvex-body :global(h2) { font-size: 20px; margin-top: 1.4rem; }
  .mdsvex-body :global(h3) { font-size: 17px; }
  .mdsvex-body :global(ul), .mdsvex-body :global(ol) { padding-left: 22px; display: grid; gap: 5px; }
  .mdsvex-body :global(li) { padding-left: 2px; line-height: 1.45; }
  .mdsvex-body :global(code) { border-radius: 5px; padding: 1px 5px; background: #f1f5f9; color: #1f2937; font-size: .92em; }
  .mdsvex-body :global(pre) { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 100%; font-size: 12px; border-radius: 8px; padding: 14px; overflow-x: auto; max-height: none; line-height: 1.55; background: #fbfbfa; border: 1px solid #eeeeeb; }
  .mdsvex-body :global(pre code) { background: transparent; color: inherit; padding: 0; }
  .mdsvex-body :global(a) { color: #0f5ec7; text-decoration: underline; text-underline-offset: 3px; font-weight: 600; }
  .mdsvex-body :global(table) { display: block; width: 100%; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 1rem 0; font-size: 13px; }
  .mdsvex-body :global(th), .mdsvex-body :global(td) { border: 1px solid #e4e4e0; padding: 7px 9px; text-align: left; vertical-align: top; }
  .mdsvex-body :global(th) { background: #fafafa; }
  .sidebar { position: sticky; top: 16px; background: transparent; border-left: 1px solid #e4e4e0; padding: 2px 0 0 16px; max-height: calc(100vh - 32px); overflow: auto; font-size: 13px; }
  .lane-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 8px; }
  .lane-status { border: 1px solid #d6d6d3; border-radius: 999px; padding: 3px 7px; color: #5d666d; background: #fff; font-size: 11px; letter-spacing: .02em; }
  .lane-status.waiting { color: #92400e; background: #fff8e8; border-color: #e8d6a3; }
  .lane-section { border-top: 1px solid #e4e4e0; margin-top: 14px; padding-top: 12px; }
  .support-review-status { background: #fff; border: 1px solid #e4e4e0; border-radius: 12px; padding: 10px; }
  .support-review-status p { margin: 0 0 8px; color: #5d666d; overflow-wrap: anywhere; }
  .status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .status-grid span { border: 1px solid #eeeeeb; border-radius: 10px; background: #fafafa; padding: 7px; display: grid; gap: 2px; }
  .status-grid strong { color: #24292f; font-size: 16px; line-height: 1; }
  .status-grid em { color: #6b7280; font-size: 11px; font-style: normal; text-transform: uppercase; letter-spacing: .04em; }
  .batch-actions { display: grid; gap: 7px; margin-top: 8px; }
  .batch-send { width: 100%; border: 0; border-radius: 10px; background: #0f766e; color: #fff; padding: 9px 10px; font: inherit; font-weight: 900; cursor: pointer; }
  .batch-send:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
  .active-section { border-top-color: #cfd4dc; }
  .section-label { display: flex; align-items: center; gap: 7px; color: #4b5563; font-weight: 650; font-size: 12px; letter-spacing: .02em; margin: 0 0 8px; }
  .section-label span { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; background: #24292f; color: #fff; font-size: 11px; }
  .section-label em { margin-left: auto; font-style: normal; color: #6b7280; background: #f3f4f6; border-radius: 999px; padding: 2px 7px; font-size: 11px; }
  .clear-selection { width: 100%; border: 1px solid #d6d6d3; border-radius: 7px; padding: 7px 9px; background: #fffdfa; color: #5d666d; cursor: pointer; margin: 0 0 8px; font-size: 13px; }
  .selected-box { display: grid; gap: 4px; padding: 8px; margin: 10px 0; background: #f7f7f5; border-radius: 7px; font-size: 12px; }
  .selected-box p { margin: 0; word-break: break-word; }
  .selected-box span { color: #6b7280; margin-right: 6px; }
  textarea { width: 100%; min-height: 78px; border: 1px solid #d6d6d3; border-radius: 6px; padding: 9px; resize: vertical; margin: 7px 0; font-size: 13px; background: #fff; }
  .actions { display: flex; gap: 8px; margin: 8px 0; }
  .actions button, .primary { flex: 1 1 0; min-width: 0; border: 1px solid #d6d6d3; border-radius: 7px; padding: 7px 9px; background: #fff; color: #24292f; cursor: pointer; display: inline-flex; gap: 7px; align-items: center; justify-content: center; min-height: 34px; font-size: 13px; line-height: 1.15; white-space: nowrap; }
  .actions .secondary { flex: 0 0 auto; color: #5d666d; background: #fffdfa; }
  .primary, .actions .primary { background: #24292f; color: #fff; border-color: #24292f; }
  .actions button:disabled, .primary:disabled { background: #fff; color: #a1a1aa; border-color: #e5e5e5; cursor: not-allowed; }
  .queue { display: grid; gap: 8px; margin: 10px 0; }
  .queued { background: #f7f7f5; border-radius: 8px; padding: 9px; font-size: 13px; border-left: 3px solid #9ca3af; }
  .queued span { color: #6b7280; font-size: 12px; }
  .queued p { margin: 5px 0 0; color: #5d666d; word-break: break-word; }
  .roundtrip p { color: #5d666d; margin: 0 0 6px; line-height: 1.45; overflow-wrap: anywhere; }
  .agent-work { background: #fff; border: 1px solid #e4e4e0; border-radius: 12px; padding: 10px; }
  .activity-list { display: grid; gap: 6px; margin-top: 8px; }
  .activity { border-left: 3px solid #60a5fa; background: #eff6ff; border-radius: 8px; padding: 7px 8px; display: grid; gap: 2px; }
  .activity.good { border-left-color: #14b8a6; background: #ecfdf5; }
  .activity.bad { border-left-color: #ef4444; background: #fff1f2; }
  .activity strong { color: #1f2937; font-size: 12px; }
  .activity span { color: #5d666d; font-size: 12px; overflow-wrap: anywhere; }
  .send-receipt { margin: 6px 0 0; color: #5d666d; font-size: 12px; overflow-wrap: anywhere; }
  .loading { padding: 24px; }
  @media (max-width: 1000px) { .layout { grid-template-columns: minmax(0, 1fr); } .sidebar { position: static; max-height: none; border-left: 0; border-top: 1px solid #e4e4e0; padding-left: 0; padding-top: 16px; min-width: 0; } }
  @media (max-width: 640px) {
    .topbar.compact { padding: 8px 10px 4px; gap: 8px; max-width: 100vw; }
    .crumb-title { min-width: 0; flex: 1; }
    .topbar.compact .agent { flex: 0 0 auto; }
    .layout { padding: 6px 8px 28px; gap: 10px; }
    .email-body { padding: 8px 10px 12px; }
    .email-chrome-block { padding: 10px 12px; }
    .block-text { display: grid; grid-template-columns: 1fr; gap: 4px; }
    .block-text strong { white-space: normal; }
    .block-text code { width: fit-content; max-width: 100%; border-radius: 6px; }
    .mdsvex-body :global(h1) { font-size: 22px; }
    .mdsvex-body :global(h2) { font-size: 18px; }
    .mdsvex-body :global(h3) { font-size: 16px; }
    .mdsvex-body :global(ul), .mdsvex-body :global(ol) { padding-left: 18px; }
    .actions { flex-wrap: wrap; }
    .actions button, .primary { white-space: normal; }
  }
</style>
