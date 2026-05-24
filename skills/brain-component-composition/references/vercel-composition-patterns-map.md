# Vercel composition patterns mapped to Brain components

Source inspiration: `vercel-labs/agent-skills/skills/composition-patterns`, MIT licensed.

## Adapted rules

| Vercel rule | Brain and MDSvX adaptation |
|---|---|
| Avoid boolean prop proliferation | Do not build one mega Brain component with many mode flags. Split into explicit review, report, chart, dossier, and receipt variants. |
| Use compound components | Use a shell/provider component plus focused child components. The shell owns data loading, context, schema normalization, and safety state. Children render one clear part. |
| Lift state into providers | If sibling views or controls need the same data, put it in a typed Svelte context from the shell/provider. Avoid prop drilling and hidden globals. |
| Define context interfaces | For interactive review surfaces, expose `data`, `actions`, and `meta`. `data` is source-grounded state, `actions` are explicit side-effect boundaries, and `meta` is provenance, freshness, privacy, and UI state. |
| Decouple state management from UI | Presentational children should not care whether records came from JSONL, SQLite, Postgres, Typesense, or an API. Swap adapters without rewriting the UI pieces. |
| Prefer children over render props | Use MDSvX nesting, Svelte snippets, and direct child composition instead of callback props for static structure. Use callbacks only when data must flow back up. |
| Explicit variants | Name variants after intent, for example `SupportReplyCard`, `TeamSalesDossier`, `AttributionReportCharts`, or `LaunchEmailReview`. Do not hide intent in flags. |

## Brain-specific additions

- `.svx` is the durable human and agent-facing structure.
- `.brain/data` is the durable machine contract for bulky or private data.
- `.brain/components` is the reusable local component library.
- `.brain/pipeline.config.ts` can explicitly allow components used directly in MDSvX when a project needs that control.
- The pi-notes Document Host is the local render surface, not the source of truth.
- Components can point at local JSONL, SQLite, Postgres, remote APIs, or static files, but they must disclose source, freshness, privacy, and side effects.
- If a component may leave local-only space, treat private data and customer-visible links as explicit publish blockers until verified.

## Good Brain component smell

A good Brain component makes the source data more legible without turning it into a screenshot-shaped black box. Another agent should be able to open the note, see the component invocation, find the data source, read the schema, and know what is safe to do next.
