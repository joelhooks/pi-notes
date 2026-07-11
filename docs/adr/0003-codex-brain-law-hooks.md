# ADR 0003: Use Codex plugin hooks as Brain law

## Status

Accepted

## Context

The Codex plugin gives pi-notes skills to Codex, but skills are demand-loaded. That is useful, but not enough to make Brain gardening show up as default behavior in normal Codex turns.

Codex supports plugin-bundled lifecycle hooks. `SessionStart` and `UserPromptSubmit` hooks can return `hookSpecificOutput.additionalContext`, which Codex adds as developer context. This is the right surface for "law": visible to the model, scoped to the current repo, and still inspectable/trust-gated by Codex.

## Decision

Bundle a soft Brain law hook in the Codex plugin.

- Hook config lives at `hooks/hooks.json`, the default plugin-bundled hook path.
- Hook code lives at `hooks/codex-brain-law.mjs`.
- The hook activates only when the session cwd is inside a repo with `BRAIN.md` or `.brain/`.
- The hook injects concise guidance:
  - inspect `BRAIN.md` and relevant `.brain/**/*.svx` pages before major claims or edits
  - capture durable decisions, terms, tradeoffs, receipts, gotchas, review comments, workflows, open questions, and next steps
  - use the `brain-component-composition` skill for `.brain` data/component work
  - run `pi-notes brain check` or repo-local Brain checks after Brain changes
  - treat browser-to-Codex Review Batch injection as future app-server/MCP work

## Consequences

- Codex starts seeing Brain gardening context without the user remembering to invoke a skill.
- Random repos do not receive pi-notes context unless they already opt in with `BRAIN.md` or `.brain/`.
- Hook trust remains explicit through Codex's normal hook review flow.
- This is not a hard enforcement gate. A later strict mode can add a `Stop` hook, but only after we know it will not create annoying continuation loops.
