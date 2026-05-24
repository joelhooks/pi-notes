<script lang="ts">
  import { getBrainDataContext } from "./BrainDataProvider.svelte";

  const brain = getBrainDataContext();
  const run = $derived(brain.data.run);
  const meta = brain.meta;
</script>

<section class="brain-summary-card">
  <p class="eyebrow">Brain data contract</p>
  <h2>{run.title}</h2>
  <dl>
    <div>
      <dt>Total</dt>
      <dd>{run.summary.total}</dd>
    </div>
    <div>
      <dt>Ready</dt>
      <dd>{run.summary.ready}</dd>
    </div>
    <div>
      <dt>Blocked</dt>
      <dd>{run.summary.blocked}</dd>
    </div>
    <div>
      <dt>Done</dt>
      <dd>{run.summary.done}</dd>
    </div>
  </dl>
  <p class="meta">Source: <code>{meta.source}</code></p>
  <p class="meta">Schema: <code>{meta.schema}</code></p>
  <p class="meta">Freshness: <time datetime={meta.freshness}>{meta.freshness}</time></p>
  <p class="meta">Privacy: {meta.privacy}</p>
  <p class="meta">Side effects: {meta.sideEffects.join(", ")}</p>
</section>

<style>
  .brain-summary-card {
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 16px;
    padding: 1rem;
    background: #fffaf2;
    color: #1f2937;
  }

  .eyebrow {
    margin: 0 0 .25rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    font-size: .75rem;
    opacity: .7;
  }

  h2 {
    margin: 0 0 1rem;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: .5rem;
    margin: 0 0 1rem;
  }

  dl > div {
    border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    border-radius: 12px;
    padding: .65rem;
    background: white;
  }

  dt {
    font-size: .72rem;
    text-transform: uppercase;
    letter-spacing: .06em;
    opacity: .7;
  }

  dd {
    margin: .2rem 0 0;
    font-size: 1.35rem;
    font-weight: 800;
  }

  .meta {
    margin: .35rem 0 0;
    font-size: .88rem;
  }
</style>
