# ADR 0001: Build pi-notes as a Pi extension package with local review sites

## Status

Accepted

## Context

We want a local counterpart to here.now for product-namespaced static/review sites. The important behavior is not generic static publishing; it is local review documents that can send feedback back to the Pi session that spawned them.

Existing reference: `/Users/joel/Code/badass-courses/aihero-support/tools/sequence-review-app` has the useful shape: document loading, file watching, SSE updates, feedback batching, and optional Pi bridge URL.

## Decision

Build `pi-notes` as a new Pi package/extension at `/Users/joel/Code/joelhooks/pi-notes`.

- Pi package resources are declared in `package.json` under `pi.extensions` and `pi.skills`.
- Extension entrypoint lives at `extensions/pi-notes/index.ts`.
- Web review UI uses SvelteKit, mdsvex, Tailwind, and shadcn-svelte/bits-ui style primitives.
- Runtime logic prefers Effect services and XState v5 machines for bridge/serve/watch/send lifecycles.
- Local source references are shallow-cloned into `repos/` and documented in `.pi/APPEND_SYSTEM.md` and `AGENTS.md`.

## Consequences

- Pi session integration is a first-class runtime feature instead of bolted onto a static site generator.
- `portless` can provide stable product-namespaced local URLs.
- The package can be installed by Pi directly as a local path or later via git/npm.
- We must manage server lifecycle carefully on Pi `session_shutdown`.
