# Svelte 5 Brain component patterns

Use these rules when building pi-notes Document Host components, project-local `.brain/components`, or MDSvX review surfaces.

## Translate the composition rules to Svelte

| Composition rule | Svelte 5 implementation |
|---|---|
| Composition over configuration | Use explicit components and nested MDSvX instead of mode flags. |
| Compound components | Use a shell/provider component plus focused child components. |
| Lift state | Use `$state` in the shell, context, or a `.svelte.ts` state capsule. |
| Context interface | Expose `data`, `actions`, and `meta` through typed props or type-safe context. |
| Decouple implementation | Child views consume contracts, not storage details. |
| Children over render props | Use `Snippet` and `{@render}`. |
| Explicit variants | Name real workflow states as components. |

## Canonical component roles

### Data shell

Owns data loading, normalization, freshness, privacy, and context setup.

Good examples:

- `TriagePreflight`
- `SupportReviewProvider`
- `EmailReviewProvider`
- `BrainInventoryProvider`

### View component

Renders one focused view from a typed contract. It should not know if data came from JSONL, SQLite, Postgres, Typesense, or an API.

Good examples:

- `AIHTriagePriority`
- `AIHThreadList`
- `AIHPreflightReceipts`
- `ShortlinkVerificationPanel`

### Action component

Causes side effects through explicit actions. It must disclose side effects and respect customer-visible gates.

Good examples:

- `FeedbackControls`
- `ApproveDraftButton`
- `QueueRewriteButton`

### Variant component

Names a real workflow branch instead of hiding it behind boolean props.

Good examples:

- `DraftReviewCard`
- `ArchiveRecommendationCard`
- `BlockedSupportCard`
- `TeamSaleReviewCard`

## Shipped scaffold

Use `examples/brain-provider-variant-surface/` as the copyable starter when a Brain surface needs shared data plus explicit status variants.

Core files:

- `BrainDataProvider.svelte`, typed `data`, `actions`, and `meta` context
- `BrainSummaryCard.svelte`, focused summary view from the provider contract
- `BrainReceiptList.svelte`, filter and paging UI that routes to explicit receipt variants
- `BrainReceiptReady.svelte`, `BrainReceiptBlocked.svelte`, and `BrainReceiptDone.svelte`, named workflow branches

## Runes rules

- Use `$props()` with explicit `Props` interfaces.
- Use `$state` for local mutable UI or shell state.
- Use `$derived` for pure computed state.
- Use `$effect` only for effects: browser listeners, subscriptions, DOM integration, timers, fetch lifecycle, or cleanup.
- Do not use `$effect` just to compute values that could be `$derived`.
- Use `$state.raw` or plain imports for large static data when deep proxy reactivity is wasted.
- Use `$state.snapshot` before passing reactive data to APIs or libraries that expect plain objects.
- Use `$bindable` only when two-way binding is the intended component API. Do not mutate state you do not own.

## Props and snippets

Use this shape for new components:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    title: string;
    children?: Snippet;
  };

  let { title, children }: Props = $props();
</script>

<section>
  <h2>{title}</h2>
  {@render children?.()}
</section>
```

Prefer callback props and DOM event attributes in new code:

```svelte
<script lang="ts">
  type Props = {
    onApprove?: () => void;
  };

  let { onApprove }: Props = $props();
</script>

<button type="button" onclick={onApprove}>Approve</button>
```

Avoid new `createEventDispatcher` usage unless maintaining legacy code.

## Type-safe context

Prefer Svelte 5 `createContext` when available:

```ts
// review-context.svelte.ts
import { createContext } from "svelte";

export type ReviewContext = {
  data: {
    cards: Array<{ id: string; status: string }>;
  };
  actions: {
    approve: (id: string) => Promise<void>;
  };
  meta: {
    source: string;
    generatedAt: string;
    privacy: "local" | "publishable";
  };
};

export const [getReviewContext, setReviewContext] = createContext<ReviewContext>();
```

Provider component:

```svelte
<script lang="ts">
  import { setReviewContext } from "./review-context.svelte";

  let data = $state({ cards: [] as Array<{ id: string; status: string }> });
  let meta = $state({
    source: ".brain/data/support-review/latest.json",
    generatedAt: new Date().toISOString(),
    privacy: "local" as const,
  });

  const actions = {
    async approve(id: string) {
      // gate side effects here
    },
  };

  setReviewContext({ data, actions, meta });
</script>

{@render children?.()}
```

Child component:

```svelte
<script lang="ts">
  import { getReviewContext } from "./review-context.svelte";

  const review = getReviewContext();
  const approved = $derived(review.data.cards.filter((card) => card.status === "approved"));
</script>

<p>{approved.length} approved</p>
```

If using `setContext` and `getContext` directly, use a `Symbol` key and a typed helper module.

## Context gotcha

Reactive context works when you pass a `$state` object by reference and mutate it. Do not reassign the object.

Good:

```ts
state.count = 0;
```

Bad:

```ts
state = { count: 0 };
```

Reassignment breaks the link children read from context.

## `.svelte.ts` state capsules

Use a state capsule when the same reactive behavior belongs in more than one component or the provider logic is getting chunky.

Prefer a factory object first:

```ts
// support-review-state.svelte.ts
export function createSupportReviewState(source: string) {
  const data = $state({ cards: [] as Array<{ id: string; status: string }> });
  const meta = $state({ source, privacy: "local" as const });

  const pending = $derived(data.cards.filter((card) => card.status === "pending"));

  const actions = {
    markPending(id: string) {
      const card = data.cards.find((item) => item.id === id);
      if (card) card.status = "pending";
    },
  };

  return {
    data,
    actions,
    meta,
    get pending() {
      return pending;
    },
  };
}
```

Use classes only when methods, lifecycle, and grouping are clearer than the object factory.

## Brain-specific checklist

Before shipping a Brain component, verify:

- Props are typed.
- The component has explicit empty, stale, loading, error, and privacy states when data-backed.
- Data sources are visible in props, meta, or surrounding `.svx`.
- Side effects are named under `actions` and gated.
- Large lists are paginated or virtualized.
- Raw private data is not publishable by accident.
- `pi-notes brain check` passes.
