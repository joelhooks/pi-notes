# ADR 0002: Make pi-notes a multi-harness package

## Status

Accepted

## Context

pi-notes started as a Pi extension because the first valuable loop was browser feedback returning to the Pi session that opened the review document. That remains true, but the reusable parts are broader than Pi:

- `.brain/**/*.svx` as durable project memory
- `.brain/data/**` and `.brain/components/**` as data-backed review surfaces
- the SvelteKit/mdsvex Document Host
- the `pi-notes` CLI and validation rules
- bundled skills for Brain composition, diagrams, and review workflows

Codex plugins can bundle skills, app integrations, and MCP servers. That makes Codex a good second harness for pi-notes, as long as the package does not pretend Pi session APIs exist in Codex.

## Decision

Make the package root a multi-harness package.

- Keep the Pi adapter at `extensions/pi-notes/index.ts`.
- Keep shared skills canonical under `skills/`.
- Add `.codex-plugin/plugin.json` at the package root so Codex can load the same skills.
- Keep the initial Codex integration skill-first and CLI-backed.
- Treat active browser-to-agent feedback as adapter-specific:
  - Pi uses the existing extension bridge.
  - Codex should use Codex app-server or MCP in a later slice.

## Consequences

- The package can be installed by Pi and discovered by Codex without duplicating skills.
- `pi-notes` becomes core plus adapters, not a Pi-only extension.
- The Codex plugin gives immediate value for Brain editing, validation, and review-surface construction.
- The Codex plugin does not yet provide the full browser Review Batch to active Codex thread loop.
- Future bridge work should factor shared receipt and batch handling out of the Pi extension before adding a Codex app-server or MCP adapter.
