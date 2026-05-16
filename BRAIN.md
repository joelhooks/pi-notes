# BRAIN.md

pi-notes operating brain for agents.

## Purpose

Build and use pi-notes as an agent-connected second brain for projects.

Your brain is for having ideas. pi-notes is for storing, linking, reviewing, and turning them into output with an active Pi agent in the loop.

## Organizing rule: PARA

Organize by usefulness, not topic.

- **Projects**: active efforts with an outcome. Most work belongs here.
- **Areas**: ongoing responsibilities to maintain.
- **Resources**: useful reference material not tied to current work.
- **Archives**: inactive projects, areas, and resources.

Ask: **Where will this be useful next?** Not: “What category is this about?”

When sorting Brain entries, prefer this filesystem shape:

```text
.brain/
  projects/active-outcome.svx
  areas/ongoing-responsibility.svx
  resources/reference-material.svx
  archives/inactive-or-superseded.svx
```

Flat `.brain/*.svx` files are treated as **Projects** until deliberately sorted.

## Knowledge rule: atomic linked notes

Use Roam/Zettelkasten style construction without the chaos.

- one idea per block when possible
- link related concepts
- preserve backlinks and graph edges
- write in our words
- let structure emerge, then clean it up

## Agent loop: CORE

Every agent session should move knowledge through this loop:

- **Capture**: save what resonates or matters
- **Organize**: put it where it will be useful
- **Refine**: sharpen language, links, edges, and summaries
- **Express**: turn it into code, docs, decisions, UI, issues, or plans

Storage is not the goal. Output is the goal.

## Capture triggers

Capture when you find:

- a decision
- a new term
- a fuzzy term that needs sharpening
- a tradeoff
- a source/receipt
- a gotcha
- a reusable workflow
- an unresolved question
- a review comment from the browser

## Review behavior

When reviewing pi-notes content:

1. Prefer precise block feedback over whole-doc vibes.
2. Suggest graph edges and backlinks.
3. Flag duplicate or orphan concepts.
4. Push fuzzy language into canonical terms.
5. Fold temporary captures into durable notes.
6. Keep browser pages read-only; agents own source edits.

## System shape

pi-notes should provide:

- project-custom mdsvex/Svelte knowledge UIs
- block refs and graph edges
- backlinks and orphan/duplicate reviews
- Review Batches from browser to Pi
- active session bridge
- source-grounded updates with receipts

## Anti-goals

Do not build:

- a generic static site generator
- an Obsidian clone
- a bloated PKM ceremony machine
- append-only logs as the source of truth
- perfect organization before useful output

Keep it thin. Keep it useful. Keep the agent loop alive.
