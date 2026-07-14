<script lang="ts">
  import { onMount } from "svelte";

  type Props = {
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
    playbackId,
    title,
    poster,
    storyboardSrc,
    aspectRatio = "16 / 9",
    startTime,
    muted = false,
    autoplay = false,
  }: Props = $props();

  const resolvedPoster = $derived(
    poster ?? `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1600`,
  );
  const resolvedStoryboardSrc = $derived(
    storyboardSrc ?? `https://image.mux.com/${playbackId}/storyboard.vtt?format=webp`,
  );

  onMount(() => {
    void import("@mux/mux-player");
  });
</script>

<mux-player
  playback-id={playbackId}
  stream-type="on-demand"
  poster={resolvedPoster}
  storyboard-src={resolvedStoryboardSrc}
  {title}
  start-time={startTime}
  {muted}
  {autoplay}
  preload="metadata"
  style:aspect-ratio={aspectRatio}
></mux-player>

<style>
  mux-player {
    display: block;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    border-radius: 14px;
    background: #171717;
  }
</style>
