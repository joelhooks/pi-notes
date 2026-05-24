<script lang="ts">
  import BrainReceiptBlocked from "./BrainReceiptBlocked.svelte";
  import BrainReceiptDone from "./BrainReceiptDone.svelte";
  import BrainReceiptReady from "./BrainReceiptReady.svelte";
  import { getBrainDataContext } from "./BrainDataProvider.svelte";

  const brain = getBrainDataContext();
  const filters = $derived(brain.data.filters);
  const selectedFilter = $derived(brain.data.selectedFilter);
  const visibleReceipts = $derived(brain.data.visibleReceipts);
  const hasMore = $derived(brain.data.hasMore);

  function selectFilter(event: MouseEvent, filter: (typeof filters)[number]) {
    event.stopPropagation();
    brain.actions.setFilter(filter);
  }

  function showMore(event: MouseEvent) {
    event.stopPropagation();
    brain.actions.showMore();
  }
</script>

<section class="brain-receipt-list">
  <header>
    <div>
      <p class="eyebrow">Receipt variants</p>
      <h2>{visibleReceipts.length} visible receipts</h2>
    </div>
    <div class="filters" aria-label="Receipt filters">
      {#each filters as filter}
        <button
          type="button"
          data-no-block-select
          class:active={filter === selectedFilter}
          aria-pressed={filter === selectedFilter}
          onclick={(event) => selectFilter(event, filter)}
        >
          {filter}
        </button>
      {/each}
    </div>
  </header>

  {#if visibleReceipts.length === 0}
    <p class="empty">No receipts match this filter.</p>
  {:else}
    <div class="receipts">
      {#each visibleReceipts as receipt (receipt.id)}
        {#if receipt.status === "ready"}
          <BrainReceiptReady {receipt} />
        {:else if receipt.status === "blocked"}
          <BrainReceiptBlocked {receipt} />
        {:else if receipt.status === "done"}
          <BrainReceiptDone {receipt} />
        {/if}
      {/each}
    </div>
  {/if}

  {#if hasMore}
    <button type="button" class="more" data-no-block-select onclick={showMore}>Show more</button>
  {/if}
</section>

<style>
  .brain-receipt-list {
    display: grid;
    gap: .9rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  .eyebrow {
    margin: 0 0 .25rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    font-size: .75rem;
    opacity: .7;
  }

  h2 {
    margin: 0;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: .45rem;
  }

  button {
    border: 1px solid currentColor;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    padding: .4rem .7rem;
    font: inherit;
    cursor: pointer;
  }

  button.active {
    background: #111827;
    color: white;
  }

  .receipts {
    display: grid;
    gap: .65rem;
  }

  .empty {
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 14px;
    padding: .85rem;
  }

  .more {
    justify-self: start;
  }
</style>
