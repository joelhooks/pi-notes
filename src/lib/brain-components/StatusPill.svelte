<script lang="ts">
  type Props = {
    label?: string;
    tone?: "neutral" | "success" | "warning" | "danger" | string;
  };

  let { label = "status", tone = "neutral" }: Props = $props();
</script>

<span class="status-pill" data-tone={tone}>{label}</span>

<style>
  .status-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid #d8d1c3;
    background: #f6f1e8;
    padding: .18rem .5rem;
    font-size: .78rem;
    font-weight: 750;
    color: #625b50;
  }
  .status-pill[data-tone="success"] { color: #0f766e; background: #f0fdfa; border-color: #99f6e4; }
  .status-pill[data-tone="warning"] { color: #92400e; background: #fffbeb; border-color: #fde68a; }
  .status-pill[data-tone="danger"] { color: #b42318; background: #fff1f2; border-color: #fecaca; }
</style>
