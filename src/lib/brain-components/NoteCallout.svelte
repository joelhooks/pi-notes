<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    tone?: "info" | "warning" | string;
    title?: string;
    children?: Snippet;
  };

  let { tone = "info", title = "Note", children }: Props = $props();
</script>

<section class="note-callout" data-tone={tone}>
  <strong>{title}</strong>
  <div>{@render children?.()}</div>
</section>

<style>
  .note-callout {
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 16px;
    padding: 1rem;
    background: color-mix(in srgb, currentColor 4%, transparent);
    margin: 1rem 0;
  }
  .note-callout[data-tone="warning"] {
    color: #92400e;
    background: #fffbeb;
    border-color: #fde68a;
  }
  strong { display: block; margin-bottom: .35rem; }
</style>
