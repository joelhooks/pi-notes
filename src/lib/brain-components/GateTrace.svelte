<script lang="ts">
  type Gate = { label: string; status: "loaded" | "blocked" | "missing" | "ok" | string };
  type Props = { gates?: Gate[] };

  let { gates = [] }: Props = $props();
</script>

<section class="gate-trace">
  {#each gates as gate (`${gate.label}:${gate.status}`)}
    <div class="gate-row" data-status={gate.status}>
      <span>{gate.label}</span>
      <strong>{gate.status}</strong>
    </div>
  {/each}
</section>

<style>
  .gate-trace { display: grid; gap: .5rem; margin: 1rem 0; }
  .gate-row { display: flex; justify-content: space-between; gap: 1rem; border: 1px solid #e6dfd2; border-radius: 12px; padding: .55rem .7rem; background: white; }
  .gate-row strong { color: #0f766e; }
  .gate-row[data-status="blocked"] strong, .gate-row[data-status="missing"] strong { color: #b42318; }
</style>
