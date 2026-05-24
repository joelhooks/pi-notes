# pi-notes agent notes

pi-notes is a Pi extension package for local, product-namespaced review documents.

## Source references

Full local source references are intentionally available under `repos/`:

- `repos/pi/` — shallow canonical source subtree from `https://github.com/earendil-works/pi`. Read its `AGENTS.md` before reasoning about Pi extension/session/RPC capabilities.
- `repos/pi-mono/` — local shallow source subtree of Pi source. Read its `AGENTS.md` and package docs before implementing Pi extension behavior.
- `repos/effect/` — shallow source subtree of Effect source. Read its `AGENTS.md` before implementing Effect-heavy code.
- `repos/keystrok/` — shallow source subtree of Kunal Tanwar's keystrok. Use only as design/API inspiration with MIT license credit. Do not blindly copy without preserving license notice.

These repos are reference material, not app runtime dependencies. Keep them excluded from TypeScript, SvelteKit, Vite, and formatters.

## Self-documenting rig

This repo uses a `.brain/` knowledge graph modeled after `/Users/joel/Code/badass-courses/course-the-claw-minions-of-toil`.

- `.brain/index.svx` is the index.
- `.brain/areas/build-process.svx` captures durable build process knowledge.
- `.brain/areas/concepts.svx` captures concepts/glossary.
- `.brain/areas/review.svx` captures current review findings and next implementation concepts.
- Do not create append-only build logs as the source of truth. Put knowledge in the focused topic where it belongs.
- Project-local gremlin extension lives at `.pi/extensions/gremlin/index.ts` and injects `docs/project/identity.md` + `docs/project/tools.md`.
- Use `pi_notes_capture` after meaningful decisions, concepts, gotchas, risks, and next steps.
- Use `/phase <research|shape|plan|build|capture|review>` to keep capture context honest.

## Design principles

- This is a Pi extension first, web app second.
- Prefer type-safe Effect services for server/runtime boundaries.
- Use XState v5 for finite lifecycle workflows: site serving, Pi bridge sessions, file watching, send/retry/cancel, review turn status.
- Use SvelteKit + mdsvex for review documents and local UI.
- Use the bundled `brain-component-composition` skill when creating or editing `.brain/**/*.svx`, `.brain/components`, `.brain/data`, or data-backed review surfaces.
- Treat `.brain/components` as a real project component library. Prefer shell/provider components, focused child components, explicit variants, and visible data contracts over boolean prop soup or giant static markdown dumps.
- Use Tailwind + shadcn-svelte/bits-ui sparingly.
- Typography-first, restrained, hyper-readable, keyboard navigable. Minimal chrome. No glossy SaaS bullshit.
- Product namespace is a first-class concept, not a folder naming accident.

## Pi extension rules

- Follow Pi extension docs in `repos/pi-mono` and installed Pi docs.
- Runtime Pi dependencies should be peer dependencies: `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `typebox`.
- Extension entrypoint: `extensions/pi-notes/index.ts`.
- Package manifest must expose resources with the `pi` key in `package.json`.
- For custom tools that mutate files, use Pi's file mutation queue helpers.
- Do not create background servers without lifecycle cleanup on `session_shutdown`.

## Validation

After code changes, run:

```bash
bun run check
pi-notes brain check
```

If tests are added or modified, run targeted tests.
