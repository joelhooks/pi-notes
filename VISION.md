# Vision

pi-notes is the local knowledge and review substrate for agent-assisted work.

It turns a repo's `.brain/` into readable MDSvX/Svelte pages, keeps source edits in the repo, and routes browser feedback back to the agent session that opened the page. The goal is not another notes app. The goal is a dependable work surface where humans can read, comment, and steer while agents keep the durable record clean.

**Scope:** this document governs the pi-notes project and package: the Pi extension, Document Host, Brain scaffold, MDSvX rendering pipeline, shared component library, diagram renderers, templates, and cross-harness instruction coverage.

**Audience:** users, contributors, maintainers, and agents deciding what kind of work belongs here. Operational rollout details for private machines, teams, credentials, and local infrastructure belong in private Brain/operator docs, not this public vision.

## Who We Serve

- **Primary users:** Joel and other operator-builders using Pi to produce, review, and maintain durable project knowledge.
- **Secondary users:** agents working in repos that have pi-notes installed and need a clear place to capture decisions, receipts, diagrams, and review feedback.
- **Maintainers and contributors:** people improving the package, templates, components, and integration behavior.
- **Not for:** generic blogging, public CMS publishing, Obsidian cloning, dashboard sludge, or static docs with no agent feedback loop.

## Durable Outcomes

1. **Every project gets a useful Brain by default.** Installing pi-notes should give a repo a good `.brain/` scaffold, product namespace, rendering pipeline, and agent instructions without bespoke hand setup.
2. **Browser review becomes part of the agent loop.** Selecting text, commenting, and sending a Review Batch should reliably reach the spawning session, leave receipts, and avoid duplicate delivery.
3. **MDSvX notes become composable local software.** Notes can use safe Svelte components, structured `.brain/data/**`, and project overrides without turning prose into a fragile app dump.
4. **Diagrams are source-grounded and reviewable.** Mermaid, D2, Excalidraw-derived artifacts, and the pi-notes DAG DSL should share a diagram adapter model: concise source in the repo, deterministic cached render output, visible provenance, and readable light/dark pages.
5. **Agent instructions travel with the package.** Pi, Claude, Codex, and other installed harnesses should all learn the same pi-notes expectations: use Brain when present, keep notes source-grounded, use MDSvX correctly, and prefer Review Batches over chat-only feedback.
6. **Project Memory Portals become the durable operator view.** A project Brain should render as a stable locally hosted or statically served SvelteKit/MDSvX portal where operators can move from project notes into workstreams, sessions, turns, and tool-call receipts without treating raw transcripts as the artifact.

## Current Priorities

1. **Shared component library for Brain MDSvX.** Build a shadcn-like library of focused Svelte components for notes: callouts, receipts, status cards, review batches, diagrams, source references, data tables, timelines, graph links, and adapter-specific review surfaces.
2. **Template system that can be updated after install.** New pi-notes projects should start from the latest scaffold, and existing installs should be able to diff/apply template updates without clobbering local Brain content.
3. **Diagram adapters.** Treat Mermaid support as the first adapter, not the whole diagram strategy. Add D2 support through the same cache/provenance/display contract. Use tldraw where it improves the visual result, but do not force every diagram language through tldraw if the native renderer is the better source of truth.
4. **Cross-harness prompt coverage.** Provide package-owned instruction snippets for Pi, Claude, Codex, and repo-local agent files so installed projects consistently apply pi-notes practices.
5. **Reliable review delivery.** Keep improving the Session Bridge, Review Batch trace, receipt model, and recovery behavior until browser feedback feels boringly dependable.
6. **Project Memory Portal and session history adapters.** Add stable project/workstream/session routes and data contracts so products like `pi-discord-threads` can emit session-memory records while pi-notes owns the Document Host, `.brain` rendering, tailnet-safe URLs, and drilldown UI.

## Architecture Bets

- **Pi extension first, web app second.** The Document Host exists to serve agent-connected local review work.
- **Brain is code-adjacent project memory.** `.brain/` is not a transcript dump. It is authored source with links, components, data contracts, and receipts.
- **Project Memory Portal is the stable product surface.** `.brain/` stays the source/data layer; the SvelteKit/MDSvX Document Host renders the durable portal and can be served locally, on tailnet, or as static output when safe.
- **MDSvX is the note runtime.** Markdown should stay readable. Svelte components should handle repeated structure, large data, interactivity, and review-specific UI.
- **Component resolution is layered.** Project components override package components. Package components provide good defaults. Missing components should fail visibly and helpfully.
- **Diagram rendering is adapter-based.** Each diagram source has an adapter that extracts source, computes a stable hash, renders cached artifacts, records provenance, and serves light/dark review output.
- **Template state is managed, not copied once and forgotten.** Installed projects need a way to know which template version they started from and what safe updates are available.
- **Agent guidance is generated from one source of truth.** Pi commands, `AGENTS.md`, `CLAUDE.md`, Codex instructions, skills, and template files should not drift into five subtly different religions.

## Component Library Policy

The default component library should feel like shadcn for local Brain pages: copyable, inspectable, tasteful, and easy to override.

Components should be:

- small and composable, not mega-components with boolean soup
- Svelte 5 native, typed, and friendly to MDSvX
- readable without JavaScript when possible
- explicit about data sources, freshness, privacy, and side effects
- safe with private local data by default
- good enough visually that agents stop inventing ugly one-off markup

Project-local components belong in `.brain/components/**`. Structured data belongs in `.brain/data/**`. The `.svx` file should remain the narrative shell.

## Diagram Policy

Mermaid and D2 should both be supported, but they are not the same problem.

- Mermaid can render through the tldraw-flavored path when that gives us consistent, readable SVGs.
- D2 should first use its own layout/rendering engine through a pi-notes adapter, then optionally map into tldraw shapes only if that improves editing or visual consistency.
- The pi-notes DAG DSL remains the house format for diagrams where we want strict style, deterministic layout, and agent-editable simplicity.
- Rendered artifacts are cache outputs, not canonical source.
- Every rendered diagram should expose enough provenance for an agent to find and edit the source.

## Agent and Harness Policy

pi-notes should make the right behavior the default wherever it is installed.

Installed projects should receive or update:

- repo-local agent instructions that point agents at `.brain/`, `VISION.md`, and pi-notes commands
- Pi extension prompts and tools for capture, review batches, Document Host URLs, and Brain checks
- Claude/Codex-compatible instruction snippets where those harnesses use repo files
- skills that teach MDSvX component composition, source-grounded notes, diagram adapters, and review receipts
- checks that catch broken Brain structure, unsafe MDSvX/component patterns, and stale generated artifacts

`VISION.md` is product intent. Exact commands, lifecycle rules, private rollout steps, and harness-specific mechanics belong in `AGENTS.md`, skills, templates, and private operator docs.

## Merge by Default

These changes fit the vision when they are small, tested, and source-grounded:

- fixes to Review Batch delivery, tracing, receipts, and duplicate-send protection
- Brain checker improvements that protect existing intended structure
- documentation fixes that clarify existing concepts without changing policy
- new standard components with clear props, examples, and safe defaults
- narrow Project Memory Portal/session-history adapters with explicit privacy, freshness, and source-truth boundaries
- template updates that are diffable and do not overwrite project-owned content
- diagram adapter fixes that preserve source as canonical and cache as output
- accessibility and keyboard-navigation improvements that reduce review friction

## Needs Owner Sign-Off

Stop and get explicit approval before merging:

- new public product promises or a changed target audience
- changes to extension lifecycle, bridge security, auth, data retention, or local server exposure
- broad rewrites of the Brain model, template system, component resolution rules, or Project Memory Portal routing/data-retention model
- new runtime dependency families that materially increase install size or maintenance burden
- behavior that overwrites project Brain content, agent instruction files, or local components
- publishing or syncing private machine, customer, credential, or operator details into package artifacts

## Will Not Do For Now

- Become a generic public publishing platform.
- Clone Obsidian, Notion, Roam, or here.now feature-for-feature.
- Treat chat transcripts as the artifact.
- Hide project knowledge inside opaque databases when `.svx`, `.brain/data`, and source files would be clearer.
- Let product-specific adapters define the core architecture.
- Make tldraw, Mermaid, D2, or Excalidraw the single diagram religion.
- Add dashboards where a readable note, receipt, or review page would do.

## Evidence of Progress

pi-notes is getting better when:

- a fresh install creates a usable Brain and review surface in minutes
- existing projects can safely apply template/component updates
- agents consistently write durable Brain receipts without being nagged
- browser feedback reliably arrives in the spawning session with traceable receipts
- MDSvX pages stay readable as source while rendering rich local components
- project/workstream/session history is reachable through stable portal links without making Discord, raw JSONL, or opaque databases the human artifact
- diagrams are easy for agents to edit and easy for humans to read
- private operator rollout details stay private while public package behavior remains clear

## Amendment Policy

This vision should change when real project use proves it wrong or incomplete. Agents may propose amendments with receipts from code, Brain notes, user feedback, or failed workflows. A human owner approves changes.
