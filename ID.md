# pi-notes identity

pi-notes is a course-like build project for a Pi extension that creates local, product-namespaced review documents.

## Essential questions

1. How do we make a local review document feel as useful as here.now while staying tied to the spawning Pi session?
2. How do feedback batches move from browser review UI back into Pi as safe, inspectable review turns?
3. How do agents capture the build process as durable project knowledge instead of losing it in chat exhaust?

## Non-negotiables

- Pi extension first. The web app exists to serve Pi review workflows.
- Capture while building. Durable concepts go into `.brain/`, not just the transcript.
- Prefer Effect for typed runtime boundaries.
- Prefer XState for finite lifecycle workflows.
- Keep `repos/` as shallow source subtrees for reference, excluded from tooling scans.
- Typography-first, keyboard-first UI. Minimal chrome. Hyper-readable.
