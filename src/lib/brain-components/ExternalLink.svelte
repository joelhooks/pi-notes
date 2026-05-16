<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    href: string;
    children?: Snippet;
  };

  let { href, children }: Props = $props();
</script>

<a {href} rel="noreferrer">{@render children?.()}</a>
