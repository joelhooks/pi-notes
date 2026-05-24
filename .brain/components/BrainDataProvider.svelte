<script module lang="ts">
  import { createContext } from "svelte";

  export type ReceiptStatus = "ready" | "blocked" | "done";

  export type BrainReceipt = {
    id: string;
    status: ReceiptStatus;
    title: string;
    detail: string;
    capturedAt: string;
    sourcePath: string;
    sideEffects: string[];
  };

  export type BrainReviewRun = {
    id: string;
    title: string;
    schema: string;
    source: string;
    generatedAt: string;
    privacy: "local" | "publishable";
    summary: Record<ReceiptStatus | "total", number>;
    receipts: BrainReceipt[];
  };

  export type ReceiptFilter = ReceiptStatus | "all";

  export type BrainDataContext = {
    data: {
      readonly run: BrainReviewRun;
      readonly filters: ReceiptFilter[];
      readonly selectedFilter: ReceiptFilter;
      readonly filteredReceipts: BrainReceipt[];
      readonly visibleReceipts: BrainReceipt[];
      readonly hasMore: boolean;
    };
    actions: {
      setFilter: (filter: ReceiptFilter) => void;
      showMore: () => void;
    };
    meta: {
      source: string;
      schema: string;
      freshness: string;
      privacy: BrainReviewRun["privacy"];
      sideEffects: string[];
    };
  };

  export const [getBrainDataContext, setBrainDataContext] = createContext<BrainDataContext>();
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import fixture from "../data/provider-variant-review-run.json";

  type Props = {
    initialFilter?: ReceiptFilter;
    pageSize?: number;
    children?: Snippet;
  };

  let { initialFilter = "all", pageSize = 3, children }: Props = $props();

  const run = $state.raw(fixture as BrainReviewRun);
  const filters: ReceiptFilter[] = ["all", "ready", "blocked", "done"];

  let state = $state({
    selectedFilter: initialFilter,
    visibleCount: pageSize,
  });

  const filteredReceipts = $derived(
    state.selectedFilter === "all"
      ? run.receipts
      : run.receipts.filter((receipt) => receipt.status === state.selectedFilter)
  );
  const visibleReceipts = $derived(filteredReceipts.slice(0, state.visibleCount));
  const hasMore = $derived(state.visibleCount < filteredReceipts.length);

  const actions = {
    setFilter(filter: ReceiptFilter) {
      state.selectedFilter = filter;
      state.visibleCount = pageSize;
    },
    showMore() {
      state.visibleCount = Math.min(state.visibleCount + pageSize, filteredReceipts.length);
    },
  };

  setBrainDataContext({
    data: {
      get run() { return run; },
      get filters() { return filters; },
      get selectedFilter() { return state.selectedFilter; },
      get filteredReceipts() { return filteredReceipts; },
      get visibleReceipts() { return visibleReceipts; },
      get hasMore() { return hasMore; },
    },
    actions,
    meta: {
      source: run.source,
      schema: run.schema,
      freshness: run.generatedAt,
      privacy: run.privacy,
      sideEffects: ["local filter state only"],
    },
  });
</script>

<section class="brain-data-provider" data-no-block-select>
  {@render children?.()}
</section>

<style>
  .brain-data-provider {
    display: grid;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 18px;
    padding: 1rem;
    background: color-mix(in srgb, currentColor 3%, transparent);
  }
</style>
