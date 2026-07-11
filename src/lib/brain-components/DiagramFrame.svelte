<script lang="ts">
  type Props = {
    src: string;
    alt?: string;
    title?: string;
    source?: string;
    renderer?: "mermaid" | "d2" | "diagram" | "excalidraw" | string;
    caption?: string;
  };

  let { src, alt = "Diagram", title, source, renderer = "diagram", caption }: Props = $props();
</script>

<figure class="diagram-frame" data-renderer={renderer}>
  {#if title || source}
    <figcaption class="meta">
      {#if title}<strong>{title}</strong>{/if}
      <span>{renderer}</span>
      {#if source}<code>{source}</code>{/if}
    </figcaption>
  {/if}
  <img {src} {alt} loading="lazy" />
  {#if caption}<figcaption class="caption">{caption}</figcaption>{/if}
</figure>

<style>
  .diagram-frame {
    margin: 1.5rem auto;
    overflow: hidden;
    border: 1px solid #ded8cc;
    border-radius: 18px;
    background: #fbfaf7;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .5rem;
    border-bottom: 1px solid #e8e1d7;
    padding: .55rem .75rem;
    color: #5f574d;
    font-size: .82rem;
  }
  .meta strong { color: #24211d; }
  .meta span {
    border-radius: 999px;
    background: #f2eee6;
    padding: .12rem .45rem;
    font-size: .72rem;
    font-weight: 850;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .meta code { font-size: .76rem; color: #6b6258; }
  img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
    padding: .75rem;
  }
  .caption {
    border-top: 1px solid #e8e1d7;
    padding: .55rem .75rem;
    color: #6b6258;
    font-size: .86rem;
  }
</style>
