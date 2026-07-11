<script lang="ts">
  type ReceiptStatus = "handled" | "partial" | "unhandled" | "pending" | string;
  type Props = {
    batchId?: string;
    status?: ReceiptStatus;
    handled?: number;
    partial?: number;
    unhandled?: number;
    summary?: string;
  };

  let { batchId, status = "pending", handled = 0, partial = 0, unhandled = 0, summary }: Props = $props();
</script>

<section class="review-receipt" data-status={status}>
  <div class="header">
    <strong>Review receipt</strong>
    <span>{status}</span>
  </div>
  {#if batchId}<code>{batchId}</code>{/if}
  <div class="counts" aria-label="Review receipt counts">
    <span><b>{handled}</b> handled</span>
    <span><b>{partial}</b> partial</span>
    <span><b>{unhandled}</b> unhandled</span>
  </div>
  {#if summary}<p>{summary}</p>{/if}
</section>

<style>
  .review-receipt {
    margin: 1rem 0;
    border: 1px solid #ded8cc;
    border-left-width: 4px;
    border-radius: 14px;
    background: #fbfaf7;
    padding: .85rem 1rem;
  }
  .review-receipt[data-status="handled"] { border-left-color: #0f766e; }
  .review-receipt[data-status="partial"] { border-left-color: #d97706; }
  .review-receipt[data-status="unhandled"] { border-left-color: #dc2626; }
  .review-receipt[data-status="pending"] { border-left-color: #64748b; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .header strong { letter-spacing: -.01em; }
  .header span { border-radius: 999px; background: #f2eee6; padding: .15rem .5rem; color: #5f574d; font-size: .78rem; font-weight: 800; }
  code { display: block; margin-top: .35rem; color: #5f574d; font-size: .78rem; }
  .counts { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .65rem; }
  .counts span { border-radius: 999px; background: #fff; border: 1px solid #e7e0d6; padding: .18rem .5rem; font-size: .8rem; }
  p { margin: .65rem 0 0; color: #4b5563; }
</style>
