---
name: excalidraw-dag
description: Create very clean, legible Excalidraw DAG/system diagrams for pi-notes. Use for architecture diagrams, feedback loops, data/control flow, state/lifecycle maps, or any request for a simple Excalidraw diagram where readability matters.
---

# Excalidraw DAG

Create concise Excalidraw diagrams that explain systems. Prefer DAGs.

## Default shape

Use this unless the user asks otherwise:

- left-to-right flow
- 4–8 boxes max
- one concept per box
- short labels: 1–3 words plus optional tiny subtitle
- straight arrows
- no icons unless they clarify
- muted fills, dark text, lots of contrast
- output under `docs/diagrams/*.excalidraw`
- link from a Brain entry so it renders inline in `/notes`

## Hard rules

- Legibility beats completeness.
- Prefer deleting nodes over shrinking text.
- Do not make spaghetti. If edges cross, change layout or split the diagram.
- Avoid decorative bullshit: shadows, gradients, cute icons, crowded legends.
- Use `fontFamily: 5` for all text.
- Keep generated files valid Excalidraw JSON.
- Do not paste huge Excalidraw JSON into chat.

## DAG layout recipe

1. Extract nodes: actors, services, artifacts, stores, outputs.
2. Pick one primary direction: usually left → right.
3. Arrange by lifecycle stage, not implementation package.
4. Draw only the main edges needed to explain causality.
5. Label edges with verbs only when ambiguity remains.
6. Add receipts/logs as small bottom-row boxes if useful.

## pi-notes inline rendering

To show a diagram inside a note, add a fenced code block containing the diagram path:

```text
docs/diagrams/example.excalidraw
```

The Document Host renders that path inline in the note route.

## Good output summary

Always report:

- diagram file path
- Brain entry that links it
- local note URL
- element count
- what the diagram intentionally omits

## Useful current reference

- Diagram note: `.brain/resources/excalidraw-diagrams.svx`
- Local URL: `http://127.0.0.1:4188/notes/resources/excalidraw-diagrams`
- Example diagram: `docs/diagrams/pi-notes-feedback-loop.excalidraw`
