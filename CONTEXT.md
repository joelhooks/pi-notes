# pi-notes context

## Glossary

### Brain

The native project knowledgebase made of authored `.svx` pages and the source of truth for project memory.
_Avoid_: markdown graph, notes site

### Pi Note

A local review document generated or served from a Pi session. A Pi Note is not just static HTML; it can carry review actions back to the spawning Pi session.

### Product Namespace

A stable slug that groups notes, assets, routes, and review history for one product or project, for example `aihero`, `codetv`, or `joelclaw`.

### Review Document

A typography-focused, keyboard-navigable web page for reading generated material and sending specific feedback turns back to Pi.

### Review Batch

A structured payload of selected Review Document blocks, comments, requested actions, source hashes, adapter metadata, and a browser-created stable batch id sent toward a Spawned Session.

### Batch Trace

The ordered high-cardinality event trail for one Review Batch, keyed by its stable batch id across browser, Document Host, Pi Bridge, and Spawned Session.

### Trace Log

The durable repo-local JSONL record of Batch Trace events under `.pi/notes-bridge/events.jsonl`, mirrored selectively into Pi session entries.

### Review Receipt

A structured outcome written by the Spawned Session for a Review Batch that records handled, partially handled, and unhandled comment ids plus changed files and notes.

### Pi Bridge

The local connection between a review document and the Pi session that spawned it. The bridge accepts feedback batches as user turns and emits status/events back to the document.

### Spawned Session

The Pi session that created or opened a review document. Feedback should route to this session unless explicitly rebound.

### Local Site

A product-namespaced SvelteKit/mdsvex site served locally, intended to be exposed through `portless` for stable `.localhost` URLs.

### Diagram Source

A concise authored diagram definition that agents edit directly. It should describe uniform nodes, simple arrow-line edges, layout intent, and coarse hints such as `rank` or bottom-row `lane` without exposing Excalidraw JSON noise.
_Avoid_: raw Excalidraw JSON as authoring source, semantic node types in the first grammar, full swimlanes in v1

### Diagram Artifact

The generated `.excalidraw` file used for rendering, sharing, and opening in Excalidraw. It is an output target, not the canonical authoring surface.

### Diagram Compiler

The deterministic step that turns a Diagram Source into a Diagram Artifact by applying layout, spacing, sizing, style tokens, and stable ids. If a source exceeds clean DAG limits, the compiler should render anyway with visible warnings rather than blocking artifact generation. The first implementation should pair the compiler with note rendering support for `.diagram` references. Compiler logic should live in a reusable server library with a thin CLI script. The note renderer must not mutate files during page load; stale or missing artifacts render a warning plus the compile command.

### Diagram Block Reference

A stable reference from a Brain page or review block to a Diagram Source. It should behave like a hashed block reference: the human-facing link stays simple, while the system can verify the source path/content hash before trusting generated artifacts.

### Diagram Artifact Metadata

Portable metadata embedded inside a generated `.excalidraw` artifact that records the Diagram Source path, source content hash, compiler version, generated timestamp, and compiler warnings. Warnings should also render in the note UI, usually as a small footer under the inline diagram.

### Brain Project Status

A small frontmatter status on `.brain/projects/*.svx` entries that makes project state visible in the programmatic `/notes` index. Use it to distinguish active work from queued, blocked, paused, done, or archived work.

### Diagram Layout Policy

The design contract for compiling Diagram Sources into legible DAGs. It should optimize for clean spacing, directional flow, wide-screen use, minimal edge crossings, readable labels, and efficient use of available canvas area. Layout should be deterministic-first with optional seeded optimization, not full force-directed chaos by default. The first compiler should use a small hand-rolled rank layout before considering Dagre or ELK.

### Diagram Style Policy

The visual contract for generated diagrams: minimal, plain, mostly grayscale, high contrast, thin borders, readable short labels, and color only when it explains structure. Node `label` text should stay around 24 characters and `sub` text around 32 characters; longer text renders with warnings. Avoid shadows, gradients, emoji, decorative icons, and loud palettes.

## Relationships

- A **Brain** is rendered by a **Local Site** through the pi-notes Document Host.
- A **Brain** can be reviewed as one or more **Review Documents**.
- A **Review Document** produces **Review Batches** with browser-created batch ids.
- A **Review Batch** has exactly one **Batch Trace** keyed by its stable batch id.
- A **Batch Trace** is persisted in the **Trace Log**.
- A **Pi Bridge** sends **Review Batches** back to the **Spawned Session**.
- A **Spawned Session** should write exactly one **Review Receipt** for each handled **Review Batch**.
- A **Diagram Source** compiles through a **Diagram Compiler** into a **Diagram Artifact**.

## Design constraints

- Local-first. here.now is inspiration, not the runtime dependency.
- Review docs need feedback/review affordances similar to `aihero-support/tools/sequence-review-app`.
- Pi Bridge should support batch turn submission plus live event/status updates.
- UI should be restrained, typography-led, and keyboard-first.
- Keystrok may be used as inspiration with MIT credit/license preservation.
