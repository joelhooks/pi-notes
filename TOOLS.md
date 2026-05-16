# pi-notes tools

## Gremlin capture extension

Project-local extension: `.pi/extensions/gremlin/index.ts`.

It treats pi-notes like a course build:

- Injects `ID.md` and `TOOLS.md` into every turn.
- Adds `/phase <research|shape|plan|build|capture|review>`.
- Adds `pi_notes_capture` for decisions, concepts, gotchas, risks, and next steps.
- Adds `course_brain_check` to run `bun run brain:check`.

## Capture rule

After meaningful work, capture the durable bit:

```text
pi_notes_capture({
  type: "decision",
  concept: "Pi Bridge",
  summary: "Feedback batches route to the spawning Pi session, not a generic inbox."
})
```

Then fold repeated captures into focused `.brain/` topic files. Do not let `.pi/course-log.jsonl` become the source of truth.

## Brain graph

Start with:

```bash
bun run brain:check
```

Main topics:

- `.brain/areas/concepts.svx`
- `.brain/areas/architecture.svx`
- `.brain/areas/build-process.svx`
- `.brain/resources/references.svx`
- `.brain/areas/review.svx`

## Source references

- `repos/pi-mono` — Pi source and extension examples
- `repos/effect` — Effect source
- `repos/keystrok` — keyboard UI inspiration, MIT licensed

`repos/` is ignored for tool scans. Force-add snapshots only when intentionally refreshing source subtrees.
