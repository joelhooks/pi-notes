<script lang="ts">
  type Props = {
    path: string;
    label?: string;
    kind?: "file" | "url" | "note" | "data" | string;
    detail?: string;
    href?: string;
  };

  let { path, label = path, kind = "file", detail, href }: Props = $props();
</script>

<span class="source-reference" data-kind={kind}>
  <span class="kind">{kind}</span>
  {#if href}
    <a {href}>{label}</a>
  {:else}
    <code>{label}</code>
  {/if}
  {#if detail}<span class="detail">{detail}</span>{/if}
</span>

<style>
  .source-reference {
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    gap: .45rem;
    border: 1px solid #ded8cc;
    border-radius: 999px;
    background: #fbfaf7;
    padding: .18rem .55rem;
    font-size: .82rem;
    vertical-align: middle;
  }
  .kind {
    color: #6b6258;
    font-size: .72rem;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  code, a {
    overflow: hidden;
    color: #1f2937;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  a { text-decoration: underline; text-underline-offset: 2px; }
  .detail { color: #776f66; }
</style>
