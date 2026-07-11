<script lang="ts">
  import { tick } from "svelte";
  import type { Component } from "svelte";

  type FallbackBlock = { id: string; kind: string; text: string; html: string; hash: string };
  type Props = { entry: string; fallbackBlocks?: FallbackBlock[] };
  type BrainModule = { default: Component };

  let { entry, fallbackBlocks = [] }: Props = $props();

  const workspaceRoot = import.meta.env.VITE_PI_NOTES_WORKSPACE_ROOT as string | undefined;
  let component = $state<Component | null>(null);
  let error = $state<string | null>(null);

  const modulePath = $derived(`${workspaceRoot || ""}/.brain/${entry}.svx`);
  const importPath = $derived(`/@fs${modulePath}`);

  let host = $state<HTMLElement>();

  function hashText(value: string) {
    let result = 0;
    for (const char of value) result = Math.imul(31, result) + char.charCodeAt(0) | 0;
    return Math.abs(result).toString(16);
  }

  function markSelectableBlocks() {
    if (!host) return;
    const candidates = host.querySelectorAll("h1,h2,h3,h4,p,li,pre,table,blockquote,article");
    candidates.forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element.closest("[data-nested-selectable-root]") && !element.matches("article")) return;
      const text = element.innerText.trim();
      if (!text) return;
      const kind = element.tagName.toLowerCase();
      element.dataset.selectableBlock = "true";
      element.dataset.blockKind = kind;
      element.dataset.blockId = `rendered-${hashText(`${kind}:${text}`)}`;
      element.dataset.selected = "false";
      if (element.matches("article")) element.dataset.nestedSelectableRoot = "true";
    });
  }

  $effect(() => {
    component = null;
    error = null;
    import(/* @vite-ignore */ importPath)
      .then(async (module: BrainModule) => {
        component = module.default;
        await tick();
        markSelectableBlocks();
      })
      .catch((cause: unknown) => {
        error = cause instanceof Error ? cause.message : String(cause);
      });
  });
</script>

<div bind:this={host} class="brain-document">
{#if error}
  {#if fallbackBlocks.length > 0}
    <section class="brain-render-fallback">
      <strong>MDSvX render failed; showing review-safe fallback.</strong>
      <code>{error}</code>
    </section>
    {#each fallbackBlocks as block (block.id)}
      <article
        data-selectable-block="true"
        data-block-kind={block.kind}
        data-block-id={`${entry}:${block.id}`}
        data-selected="false"
        class:code-block={block.kind === "code"}
      >
        {@html block.html}
      </article>
    {/each}
  {:else}
    <section class="brain-render-error">
      <strong>MDSvX render failed</strong>
      <code>{error}</code>
    </section>
  {/if}
{:else if component}
  {@const DocumentComponent = component}
  <DocumentComponent />
{:else}
  <section class="brain-render-loading">Loading MDSvX document...</section>
{/if}
</div>

<style>
  .brain-document :global([data-selectable-block]) { cursor: pointer; border-radius: 8px; transition: outline-color .12s ease, background-color .12s ease; }
  .brain-document :global([data-selectable-block][data-selected="true"]) { outline: 3px solid color-mix(in srgb, #2563eb 52%, transparent); outline-offset: 4px; background: color-mix(in srgb, #2563eb 7%, transparent); }
  .brain-render-error, .brain-render-loading, .brain-render-fallback {
    border: 1px solid #fecaca;
    border-radius: 16px;
    background: #fff1f2;
    color: #991b1b;
    padding: 1rem;
  }
  .brain-render-error code, .brain-render-fallback code { display: block; margin-top: .5rem; white-space: pre-wrap; }
  .brain-render-fallback { border-color: #fed7aa; background: #fff7ed; color: #9a3412; margin-bottom: 1rem; }
  article[data-selectable-block] { display: block; margin: 0 0 1rem; }
</style>
