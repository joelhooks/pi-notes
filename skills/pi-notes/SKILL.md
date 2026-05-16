---
name: pi-notes
description: Create or operate local product-namespaced Pi review documents that can send feedback turns back to the spawning Pi session.
---

# pi-notes

Use this skill when creating, serving, reviewing, or debugging pi-notes review documents.

## Principles

- Treat product namespace as required.
- Prefer local `portless` URLs for stable access.
- Review docs should batch precise feedback and send it back to the spawning Pi session.
- Preserve source-grounded content law when reviewing source-derived docs.
- Keep UI hyper-readable, restrained, and keyboard-first.
- For diagrams, prefer the local `excalidraw-dag` skill: clean left-to-right DAGs, few boxes, legible labels, linked from Brain entries.

## References

- Extension source: `extensions/pi-notes/index.ts`
- Domain glossary: `CONTEXT.md`
- Architecture decision: `docs/adr/0001-pi-extension-local-review-sites.md`
- Diagram guidance: `skills/excalidraw-dag/SKILL.md`
- Diagram Brain entry: `.brain/resources/excalidraw-diagrams.svx` (`http://127.0.0.1:4188/notes/resources/excalidraw-diagrams`)
- Pi source/docs: `repos/pi-mono/`
- Effect source: `repos/effect/`
- Keystrok inspiration/license: `repos/keystrok/`
