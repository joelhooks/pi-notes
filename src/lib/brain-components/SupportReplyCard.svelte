<script lang="ts">
  import type { Snippet } from "svelte";
  import ExternalLink from "./ExternalLink.svelte";

  type Props = {
    conversationId?: string;
    frontUrl?: string;
    rank?: "vip" | "high" | "normal" | "low" | string;
    status?: "ready" | "stale" | "blocked" | "needs_context" | "needs_rewrite" | string;
    gateResult?: "manual_approval_only" | "blocked" | string;
    subject?: string;
    draft?: string;
    children?: Snippet;
  };

  let {
    conversationId = "conversation",
    frontUrl = "#",
    rank = "normal",
    status = "ready",
    gateResult = "manual_approval_only",
    subject = "Support reply",
    draft = "",
    children,
  }: Props = $props();
</script>

<article class="support-reply-card" data-rank={rank} data-status={status}>
  <header>
    <div>
      <strong>{subject}</strong>
      <span>{conversationId} · {status}</span>
    </div>
    <ExternalLink href={frontUrl}>Front thread</ExternalLink>
  </header>
  <div class="meta">
    <span>{rank}</span>
    <span>{gateResult}</span>
    <span>No send path</span>
  </div>
  {#if draft}
    <pre>{draft}</pre>
  {/if}
  <div class="slot">{@render children?.()}</div>
</article>

<style>
  .support-reply-card { border: 1px solid #e6dfd2; border-radius: 22px; padding: 1rem; background: #fff; box-shadow: 0 18px 60px rgba(20,18,14,.08), 0 1px 2px rgba(20,18,14,.06); margin: 1rem 0; }
  header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
  strong { display: block; font-size: 1.1rem; letter-spacing: -.02em; }
  header span { color: #69645d; font-size: .85rem; }
  header :global(a) { color: #1d4ed8; font-weight: 800; }
  .meta { display: flex; flex-wrap: wrap; gap: .45rem; margin: .8rem 0; }
  .meta span { border: 1px solid #e6dfd2; border-radius: 999px; padding: .18rem .5rem; font-size: .78rem; color: #625b50; background: #f6f1e8; }
  pre { white-space: pre-wrap; background: #faf9f6; border: 1px solid #e6dfd2; border-radius: 16px; padding: .85rem; font: inherit; }
</style>
