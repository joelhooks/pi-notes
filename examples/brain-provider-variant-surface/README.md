# Brain provider and variants scaffold

Use this when a Brain page needs shared data, shared actions, and focused child views.

Copy these files into a project Brain:

```txt
provider-variant-review.svx -> .brain/projects/provider-variant-review.svx
provider-variant-review-run.json -> .brain/data/provider-variant-review-run.json
BrainDataProvider.svelte -> .brain/components/BrainDataProvider.svelte
BrainSummaryCard.svelte -> .brain/components/BrainSummaryCard.svelte
BrainReceiptList.svelte -> .brain/components/BrainReceiptList.svelte
BrainReceiptReady.svelte -> .brain/components/BrainReceiptReady.svelte
BrainReceiptBlocked.svelte -> .brain/components/BrainReceiptBlocked.svelte
BrainReceiptDone.svelte -> .brain/components/BrainReceiptDone.svelte
```

The page stays tiny. The JSON owns machine facts. The provider owns the `data`, `actions`, and `meta` contract. Child components render summaries, receipts, and explicit status variants.

After copying, run:

```bash
pi-notes brain check
```
