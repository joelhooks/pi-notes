<script lang="ts">
  import type { BrainReceipt } from "./BrainDataProvider.svelte";

  type Props = { receipt: BrainReceipt };
  let { receipt }: Props = $props();
</script>

<article class="receipt ready">
  <strong>{receipt.title}</strong>
  <p>{receipt.detail}</p>
  <footer>
    <time datetime={receipt.capturedAt}>{receipt.capturedAt}</time>
    <code>{receipt.sourcePath}</code>
  </footer>
</article>

<style>
  .receipt {
    border: 1px solid #99f6e4;
    border-radius: 14px;
    padding: .85rem;
    background: #ecfdf5;
    color: #134e4a;
  }

  strong {
    display: block;
    margin-bottom: .35rem;
  }

  p {
    margin: 0;
    line-height: 1.5;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
    margin-top: .7rem;
    font-size: .78rem;
    opacity: .8;
  }
</style>
