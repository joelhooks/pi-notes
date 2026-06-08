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
- For workflow, lifecycle, triage, approval, runtime, or operator-report diagrams, prefer tall vertical D2 flowcharts rendered as static SVG. Use `direction: down`, let labels breathe, and avoid crushed wide posters.
- Use the local `excalidraw-dag` skill when the note needs a hand-drawn conceptual map. Use D2 when the note needs a workflow, system path, lifecycle, or state transition.
- Default note/report pages should be quiet: compact hero, modest H1, sane letter spacing, black-on-near-white paper, paragraphs over card grids, and only enough boxes to make receipts scannable.
- For reusable report pages, prefer SvelteKit rendering MDSvX with reusable components for flowcharts, marginalia, stat lines, paragraph lists, tables, and receipts.
- Prefer Tufte-style marginalia for footnotes, source notes, privacy notes, and link context. Collapse marginalia into a left-rule note on mobile.
- Use Shiki with a Catppuccin theme for code blocks when a note includes source snippets.

## References

- Extension source: `extensions/pi-notes/index.ts`
- Domain glossary: `docs/project/context.md`
- Architecture decision: `docs/adr/0001-pi-extension-local-review-sites.md`
- Diagram guidance: `skills/excalidraw-dag/SKILL.md`
- Diagram Brain entry: `.brain/resources/excalidraw-diagrams.svx` (`http://127.0.0.1:4188/notes/resources/excalidraw-diagrams`)
- Pi source/docs: `repos/pi-mono/`
- Effect source: `repos/effect/`
- Keystrok inspiration/license: `repos/keystrok/`
