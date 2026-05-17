# pi-notes

Local Brain pages for Pi sessions.

pi-notes is a Pi extension package that turns a repo-local `.brain/` folder into readable review pages at `/notes`, then lets browser feedback come back into the Pi session that opened the page.

It is not trying to be Obsidian in a trench coat. The browser is for reading and marking things up. The agent still owns source edits and leaves receipts.

## What it gives you

- A Pi extension at `extensions/pi-notes/index.ts`
- A packaged Pi skill at `skills/pi-notes/SKILL.md`
- A local SvelteKit Document Host for `/notes`
- Per-session free ports so multiple repos can run without fixed-port fights
- Browser → Document Host → Pi session feedback batches
- First-awakening Brain scaffold for repos that do not have one yet
- `.brain/**/*.svx` pages organized as Projects, Areas, Resources, Archives
- Project statuses with `status` frontmatter
- Inline `.excalidraw` and `.diagram` previews
- A tiny Diagram DSL compiler for clean DAG-style Excalidraw artifacts

## Install

Install from the public GitHub repo:

```bash
pi install github:joelhooks/pi-notes
```

That writes a project-local `.pi/settings.json` entry in the current repo. You can also add the GitHub package explicitly:

```json
{
  "packages": ["github:joelhooks/pi-notes"]
}
```

For a quick one-off run without installing:

```bash
pi -e github:joelhooks/pi-notes
```

If your Pi version does not support the `github:` shorthand yet, use the HTTPS Git URL:

```bash
pi install https://github.com/joelhooks/pi-notes.git
```

After install or package changes, run `/reload` in Pi.

## Package shape

`package.json` exposes Pi resources with the `pi` key:

```json
{
  "pi": {
    "extensions": ["./extensions/pi-notes/index.ts"],
    "skills": ["./skills"]
  }
}
```

The package uses an explicit `files` list so npm/git package installs do not ship local session receipts, `.pi/notes-*` scratch state, reference repos, or this repo's own `.brain/` content.

Check the package payload with:

```bash
npm pack --dry-run --json
```

## First awakening behavior

On `session_start`, pi-notes checks the target repo.

If `BRAIN.md` exists, it uses that as the local operating layer.

If `BRAIN.md` is missing, it writes the bundled default.

If `.brain/` is missing, it creates:

```txt
.brain/
.brain/projects/
.brain/areas/
.brain/resources/
.brain/archives/
.brain/index.svx
```

It only creates missing files and folders. It does not overwrite existing Brain files.

## Use

Open the notes surface:

```txt
/notes
```

Useful commands:

```txt
/notes status   show Document Host and bridge state
/notes connect  repair/rebind the current session bridge
/notes open     open the local notes URL
```

Normal use should not require `/notes connect`; the extension auto-connects on session start.

## Brain pages

Brain entries are `.svx` files under `.brain/`:

```txt
.brain/projects/my-project.svx
.brain/areas/my-area.svx
.brain/resources/my-reference.svx
.brain/archives/old-thing.svx
```

Each file becomes a route:

```txt
/notes/projects/my-project
/notes/areas/my-area
/notes/resources/my-reference
```

Project entries can include a status:

```svx
---
status: active
---

# My Project
```

Allowed statuses:

```txt
active
queued
blocked
paused
done
archived
```

The `/notes` index groups entries by PARA and shows project status.

## Feedback loop

The browser review flow sends a Review Batch to the same-origin SvelteKit API. The Document Host saves an ingress receipt, forwards the batch to the extension bridge, and the bridge sends it into the current Pi session as a user turn.

Receipts and traces live under ignored local state:

```txt
.pi/notes-inbox/
.pi/notes-bridge/events.jsonl
.pi/notes-bridge/receipts/
```

A successful browser POST means delivery. A handled batch should also get a session-written receipt.

## Diagrams

Author tiny DAG diagrams in:

```txt
docs/diagrams/*.diagram
```

Compile them to Excalidraw artifacts:

```bash
bun run diagram:compile docs/diagrams/pi-notes-feedback-loop.diagram
```

Reference either artifact from a Brain page with a fenced single-path block:

````md
```txt
docs/diagrams/pi-notes-feedback-loop.diagram
```
````

The note renderer previews the existing artifact and shows stale/missing warnings. Page render does not mutate files.

## Development

Install deps:

```bash
bun install
```

Run checks:

```bash
bun run check
bunx tsc --noEmit --pretty false
bun run brain:check
npm pack --dry-run --json
```

Run the Document Host directly:

```bash
bun run dev
```

The extension normally starts the host itself with a free `PI_NOTES_PORT`.

## RPC note

Pi RPC mode is probably the future transport if pi-notes becomes a standalone external client. It gives us `get_state`, `get_messages`, streaming events, queue controls, aborts, and the extension UI protocol.

For this slice, the in-process extension bridge is still the right default because it binds directly to the spawning session with `pi.sendUserMessage(...)`.
