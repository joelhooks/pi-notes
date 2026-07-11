# pi-notes project context

This project is a Pi extension package and a course-like self-documenting build. Treat every implementation session as both product work and curriculum/source capture.

## BRAIN.md operating layer

`BRAIN.md` is the canonical operating layer. Project-local instructions and the pi-notes extension should load it directly into `before_agent_start` instead of maintaining a second hand-copied summary. It defines PARA sorting, atomic linked notes, the CORE agent loop, capture triggers, and browser-review behavior.

## Product goal

Build local, product-namespaced review documents that can be served via `portless`, receive keyboard-driven feedback in the browser, and send review turns back to the Pi session that spawned them through SSE/WebSocket-backed bridge behavior.

## Shared common core

pi-notes should become the shared substrate for local document review apps, not just another one-off static site generator.

The common core spans:

- AI Hero support pages and queue review surfaces
- `tools/sequence-review-app` style campaign/MDX-source review pages, normalized for Svelte/mdsvex rendering
- `pi-feedback` style assistant-response/file review flows
- future product-specific local pages that need browser readability plus Pi backchannel

Use this architecture language:

- **Document Host**: local SvelteKit/mdsvex server, routes, theming, assets, bridge endpoints.
- **Document Adapter**: project-specific parser/renderer/action contract. Existing `.mdx` inputs can be parsed with Unified/remark-mdx, but native Svelte documents should use mdsvex.
- **Review Surface**: shared browser UI for reading, selecting, commenting, queueing, and sending.
- **Session Bridge**: Pi extension side that binds a page to the spawning Pi session.
- **Review Batch**: domain-neutral payload of selected targets, current text, comments, rewrites, source hash, and adapter metadata.

AI Hero support should install pi-notes and provide adapters. pi-feedback should eventually use pi-notes to render a readable themable review page instead of only opening an editor diff.

## Essential capture lore

The transcript is not the artifact. The repo must remember why it exists and how it was built.

Important direction: pi-notes should become a full replacement for Brain, not merely an installer for it. Borrow Brain's best ideas, graph checks, wiki-style refs, source refs, section summaries, search/navigation, but move the experience into customizable mdsvex/Svelte review pages connected to the active Pi session.

We do like Obsidian-style graph edges and Roam Research's model of incremental knowledge construction. The difference is pi-notes puts the agent loop into the core fiber: agents capture, propose edges, fold session notes into concepts, surface graph review queues, accept browser feedback, and update the graph with receipts.

- Use `.brain/` as the durable knowledge graph.
- Use `.brain/areas/concepts.svx` for canonical vocabulary.
- Use `.brain/areas/architecture.svx` for runtime boundaries, machines, actors, and service shape.
- Use `.brain/areas/build-process.svx` for reproducible setup/build knowledge.
- Use `.brain/resources/references.svx` for source subtree policy and upstream references.
- Use `.brain/areas/review.svx` for scaffold review, risks, and next implementation concepts.
- Use `.brain/projects/sequence-review.svx` for AI Hero sequence-review adapter evidence, payloads, parser constraints, and reusable extraction notes.
- Do not create append-only build logs as the source of truth. If `.pi/course-log.jsonl` exists, treat it as a scratch capture stream and fold durable notes back into focused `.brain/` files.

Capture immediately when you make or discover:

- a decision with tradeoffs
- a new concept or renamed term
- a gotcha, failed path, or surprising constraint
- a source reference worth preserving
- a lifecycle/state-machine boundary
- an Effect service boundary
- a UI interaction rule
- a validation result or broken check that changes the plan

Prefer the project-local gremlin extension tools when available:

- `/phase <research|shape|plan|build|capture|review>` to set the current build mode
- `pi_notes_capture` to capture durable build knowledge
- `course_brain_check` to validate the Brain graph

After meaningful code/doc changes, run:

```bash
bun run check
bun run brain:check
```

`brain:check` verifies the native `.brain/*.svx` scaffold. Broken source-shape checks are blocking; wikilink validation is deferred.

## Source references

Before implementing extension behavior, use these local source references:

- Canonical Pi source: `repos/pi/`
  - Shallow snapshot of `https://github.com/earendil-works/pi`.
  - Read `repos/pi/AGENTS.md` before reasoning about what Pi can/cannot do.
  - Use it to verify extension lifecycle, session/RPC capabilities, `sendUserMessage`, and whether SvelteKit can target an existing Pi session without a custom bridge.
- Local Pi source snapshot: `repos/pi-mono/`
  - Read `repos/pi-mono/AGENTS.md` when using the local monorepo snapshot.
  - Prefer extension examples under `repos/pi-mono/examples/extensions/` when available.
  - Installed docs are also available at `/Users/joel/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/`.
- Full Effect source: `repos/effect/`
  - Read `repos/effect/AGENTS.md`.
  - Follow Effect patterns: `Effect.gen`, `Effect.fn`, services, layers, schemas, typed errors.
- Keyboard/navigation inspiration: `repos/keystrok/`
  - MIT license by Kunal Tanwar. Preserve copyright/license notice for copied or adapted substantial portions.

## Source subtree rule

`repos/` contains shallow source subtrees, not runtime dependencies. Keep it excluded from TypeScript, SvelteKit, Vite, Brain scans, and formatters. Force-add snapshots only when intentionally refreshing vendored reference source.

## Design posture

- Pi extension first, web app second.
- Prefer Effect for typed runtime boundaries.
- Prefer XState v5 for finite modes, retries, cancellation, child actors, and lifecycle status.
- Use SvelteKit + mdsvex for the review surface.
- Use Tailwind and shadcn-svelte/bits-ui sparingly.
- Typography-first. Minimal styling. Restrained, hyper-readable, keyboard-navigable. No dashboard sludge.

<!-- brain-first-workflow:start -->
# Brain-first planning workflow

This is Joel's default planning law across active projects.

- Brain is canonical. Linear/GitHub/issues are mirrors and execution surfaces, not the memory system.
- When asked for a PRD, use the PRD skill to create/update structured Brain notes first: Project, Area, Resource, and Decision notes under `.brain/` using PARA. The PRD surface belongs in Brain before tracker work.
- When running PRD-to-plan, assemble the PRD plus linked Brain context, repo docs, decisions/ADRs, code evidence, and relevant tracker comments before drafting the execution plan. Prefer saving plans in `.brain/`.
- When running `to-issues`, publish dependency-ordered vertical slices to Linear when the project is configured for Linear. Search first, link each issue back to Brain, and keep Linear concise.
- Keep Brain and Linear synced intentionally: update Brain first for durable scope/decision changes, then mirror useful issue/project state in Linear.
- For clarification, Grill Me, PRD interviews, and planning questions, use inline voice-friendly prose. Ask one question at a time with a recommended answer and why. Do not use interactive MCQ unless Joel explicitly asks for it.
- If a project lacks `.brain/`, create the minimal PARA scaffold when the first durable PRD/plan/decision appears.
<!-- brain-first-workflow:end -->

<!-- pi-notes-rig:start -->
# pi-notes installed Brain workflow

This repo uses pi-notes for durable agent-connected notes.

- Read `BRAIN.md` and relevant `.brain/**/*.svx` pages before substantial planning or edits.
- Use `.brain/` as the durable knowledge graph.
- Author Brain pages as MDSvX `.svx`.
- Use `.brain/data/**` for large structured data and `.brain/components/**/*.svelte` for reusable renderers.
- Use the `brain-component-composition` skill for Brain components, data-backed notes, and review surfaces.
- Use Review Batches and receipts for browser feedback.
- Run `pi-notes brain check` after editing Brain files.

Core terms: Document Host, Document Adapter, Review Surface, Session Bridge, Review Batch, Event Stream, Brain Component, Brain Data.
<!-- pi-notes-rig:end -->
