# Roam Research panda skill report

## Status

Completed.

## Created

- `~/.pi/agent/skills/roam-research-panda/SKILL.md`

## What it covers

- Read-only SSH access to `joel@panda:~/Code/joelhooks/egghead-roam-research`.
- Exact quick commands for reading `AGENTS.md`, the existing Roam skill, derived artifacts, process files, and the Datahike ADR.
- Hierarchy-query guidance: find page/root title, references, parents/children, collect descendants, preserve order, cite page/title/eid/uid evidence.
- Python-only helper snippets for static EDN scans because Clojure may not be on `PATH`.
- Recipes for literal term counts, `[[PARA]]` / `[[Shape Up]]` page-root context, process corpus inspection, and Datahike ADR implications.
- Output contract requiring source path, query, counts, and representative block/page/eid evidence.
- Safety rules: source EDN is immutable, panda repo stays read-only, no secrets, no overclaiming from isolated block blurbs.

## Validation

Validated locally:

```bash
wc -l ~/.pi/agent/skills/roam-research-panda/SKILL.md
sed -n '1,80p' ~/.pi/agent/skills/roam-research-panda/SKILL.md
```

Result: skill file exists and is readable (`268` lines).
