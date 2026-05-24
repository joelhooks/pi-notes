---
name: brain-component-composition
description: Design and maintain composable data-backed Brain MDSvX components for pi-notes. Use when creating or editing `.brain/**/*.svx`, `.brain/components`, `.brain/data`, pi-notes Document Host components, review surfaces, or notes that should render JSONL, SQLite, Postgres, remote data, or reusable web shapes.
license: MIT
---

# Brain Component Composition

Use this before substantial Brain note, MDSvX component, review surface, or data-backed documentation work.

This adapts the useful parts of Vercel's composition patterns to Svelte, MDSvX, and pi-notes. Brain is not flat markdown. Brain is frontmatter, prose, data contracts, and components composed into surfaces that agents and humans can both understand.

## Mandate

- Treat `.brain/components` as a real project component library, not demo code.
- When a Brain shape repeats or depends on structured data, make or improve a component.
- Keep raw machine facts in `.brain/data` or a named data source. Keep `.svx` readable and sparse.
- Components should make the data easier for an agent to consume and a human to review. If the component hides provenance or schema, it is wrong.
- Prefer components that can later flow into local review pages, static reports, emails, or product pages.

## Brain hierarchy

Before designing a Brain surface, locate the relevant layers:

1. System Brain: the user-level Brain, often `~/.brain`, for global operator doctrine, reusable concepts, and cross-project context.
2. Project Brain: `./.brain`, for local projects, areas, resources, archives, receipts, and private domain data.
3. pi-notes core components: baseline components shipped by the Document Host.
4. Project components: `./.brain/components`, for project-specific overrides and richer shapes.

Project Brain wins for local facts. System Brain supplies broad operating patterns. Do not fake cross-brain imports if the runtime does not support them yet. Link the source and leave the component/data contract clear.

## Composition workflow

1. Name the shape, for example `TriagePreflight`, `AttributionCharts`, `ReviewCard`, or `ValuePathReview`.
2. Split the contract:
   - `.svx`: durable prose, headings, links, short summaries, component invocation.
   - `.brain/data`: JSON, JSONL, SQLite snapshots, receipts, and stable machine records.
   - `.brain/components`: Svelte components that load, normalize, compose, and render.
   - data adapter: source path, query, API, schema, freshness, privacy, and provenance.
3. Prefer a shell/provider component that owns data loading and normalization.
4. Compose child components for focused views, summaries, controls, warnings, and receipts.
5. Register top-level MDSvX components in `.brain/pipeline.config.ts` when the local pipeline requires explicit registration.
6. Run `pi-notes brain check` after changes.

## Pattern rules

- Composition over configuration. Do not add boolean prop soup to one mega component.
- Use explicit variants, for example `TeamSaleReviewCard` over `<ReviewCard teamSale refund invoice>`. Impossible states should not be representable.
- Lift shared state into a provider or data shell. In Svelte, use typed props plus `setContext` and `getContext` when siblings need the same data.
- Define a generic interface with `data`, `actions`, and `meta` when a surface has shared data and review actions.
- Keep data loading decoupled from presentational children. Children should consume the interface, not know whether data came from JSONL, SQLite, Postgres, or a remote API.
- Prefer snippets, children, and nested composition over render-prop-like callback props.
- Every data-backed component needs empty, loading, stale, error, and privacy states.
- Every component that reads private data needs a clear boundary before anything is published outside local pi-notes.

## Svelte 5 quick rules

- Use `$props()` with explicit `Props` interfaces for new Svelte components.
- Use `Snippet` and `{@render children?.()}` for composable content.
- Prefer callback props and DOM event attributes such as `onclick` over `createEventDispatcher` or legacy `on:` syntax in new code.
- Use `$derived` for pure computed state. Use `$effect` only for side effects, subscriptions, DOM work, or browser events.
- Use a shell/provider component, type-safe context, or a `.svelte.ts` state capsule when siblings need shared data.
- In context, mutate the existing `$state` object. Do not reassign it and break the link.
- Use `$state.raw` or plain imports for large static data. Use `$state.snapshot` before sending reactive data to APIs.

See [the Svelte 5 appendix](references/svelte-5-brain-components.md) for provider shapes, context rules, examples, and the shipped `examples/brain-provider-variant-surface/` scaffold.

## Agent-readable contract

For every new component, leave enough for the next agent to reason without opening a browser:

- component name and purpose
- input props and expected schema
- data source path or query
- freshness and privacy rules
- action side effects, or explicit read-only status
- verification command and any rendered Brain URL if available

## Example shape

```svx
---
title: "Latest triage preflight"
source: ".brain/data/triage/latest.json"
---

# Latest triage preflight

<TriagePreflight source=".brain/data/triage/latest.json" />
```

`TriagePreflight` loads the snapshot and referenced JSONL, sets a typed context, and composes focused child views. The `.svx` stays readable. The JSON and JSONL remain the machine contract.

See [the adapted source map](references/vercel-composition-patterns-map.md) for how the Vercel composition rules map into Brain components.
