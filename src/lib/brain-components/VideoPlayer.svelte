<script lang="ts">
  import MuxPlayer from "./MuxPlayer.svelte";

  type Provider = "mux" | "stream";

  type Props = {
    provider?: Provider;
    playbackId: string;
    title?: string;
    poster?: string;
    storyboardSrc?: string;
    aspectRatio?: string;
    startTime?: number;
    muted?: boolean;
    autoplay?: boolean;
  };

  let {
    provider = "mux",
    playbackId,
    title,
    poster,
    storyboardSrc,
    aspectRatio = "16 / 9",
    startTime,
    muted = false,
    autoplay = false,
  }: Props = $props();
</script>

{#if provider === "mux"}
  <MuxPlayer
    {playbackId}
    {title}
    {poster}
    {storyboardSrc}
    {aspectRatio}
    {startTime}
    {muted}
    {autoplay}
  />
{:else if provider === "stream"}
  <div class="provider-placeholder" style:aspect-ratio={aspectRatio} role="status">
    <p>Cloudflare Stream playback isn't wired yet.</p>
  </div>
{/if}

<style>
  .provider-placeholder {
    display: grid;
    width: 100%;
    place-items: center;
    border: 1px solid #ded8cc;
    border-radius: 14px;
    background: #f5f2ec;
    color: #625b52;
    text-align: center;
  }
  p {
    margin: 1rem;
    font-size: 0.9rem;
  }
</style>
