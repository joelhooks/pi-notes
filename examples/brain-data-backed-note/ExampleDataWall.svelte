<script lang="ts">
  import records from "../data/example.json";

  type ExampleRecord = {
    id: string;
    author: string;
    text: string;
    media: null | { type: "image" | "video"; url: string };
  };

  const pageSize = 2;
  let visibleCount = $state(pageSize);
  const visibleRecords = $derived((records as ExampleRecord[]).slice(0, visibleCount));
</script>

<section class="example-data-wall" data-no-block-select>
  <header>
    <p class="eyebrow">Data-backed Brain component</p>
    <h2>{records.length} JSON records</h2>
    <p>Raw record text is rendered as text, not HTML or MDSvX.</p>
  </header>

  <div class="records">
    {#each visibleRecords as record (record.id)}
      <article class="record">
        <div>
          <strong>@{record.author}</strong>
          <code>{record.id}</code>
        </div>
        <p>{record.text}</p>

        {#if record.media?.type === "image"}
          <img src={record.media.url} alt="Example data-backed media" loading="lazy" />
        {:else if record.media?.type === "video"}
          <video src={record.media.url} controls preload="none" />
        {/if}
      </article>
    {/each}
  </div>

  {#if visibleCount < records.length}
    <button type="button" onclick={() => (visibleCount = Math.min(visibleCount + pageSize, records.length))}>
      Load more
    </button>
  {/if}
</section>

<style>
  .example-data-wall {
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 18px;
    padding: 1rem;
    background: color-mix(in srgb, currentColor 3%, transparent);
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: .08em;
    font-size: .75rem;
    opacity: .7;
  }

  .records {
    display: grid;
    gap: .8rem;
    margin: 1rem 0;
  }

  .record {
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 14px;
    padding: .9rem;
    background: canvas;
  }

  .record > div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .record img,
  .record video {
    display: block;
    width: 100%;
    max-height: 20rem;
    object-fit: cover;
    border-radius: 12px;
    margin-top: .75rem;
  }

  button {
    border: 1px solid currentColor;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    padding: .45rem .8rem;
    cursor: pointer;
  }
</style>
