<script lang="ts">
  type Props = {
    cardId?: string;
    label?: string;
  };

  let { cardId = "", label = "Feedback" }: Props = $props();
  let note = $state("");
  let receipt = $state("");
  const fieldId = $derived(`feedback-${cardId || "card"}`);

  function save() {
    receipt = `Captured locally for ${cardId || "card"}`;
  }
</script>

<section class="feedback-controls">
  <label for={fieldId}>{label}</label>
  <textarea id={fieldId} bind:value={note} placeholder="Add review feedback..."></textarea>
  <div class="actions">
    <button type="button" onclick={save}>Save feedback</button>
    {#if receipt}<span>{receipt}</span>{/if}
  </div>
</section>

<style>
  .feedback-controls { display: grid; gap: .5rem; margin-top: 1rem; }
  label { font-weight: 800; }
  textarea { min-height: 84px; border: 1px solid #e6dfd2; border-radius: 12px; padding: .75rem; font: inherit; }
  .actions { display: flex; align-items: center; gap: .75rem; }
  button { border: 0; border-radius: 12px; background: #151515; color: #f7f5ef; padding: .55rem .8rem; font-weight: 800; }
  span { color: #69645d; font-size: .85rem; }
</style>
