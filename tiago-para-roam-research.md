# Research: Tiago Forte / PARA / Second Brain material in Joel's Roam archive

## Summary

The local Roam archive is present and the right Datascript/Datalog helper scripts exist, but this worker had read/write/web tools only: no shell, no SSH, and no way to execute Clojure/Python against the 139MB single-line EDN. So this brief is a partial, source-grounded inventory from accessible derived artifacts plus the exact Datalog path that should be run next. The strongest confirmed signal is that `Just in Time Project Management` is a major page in the archive: page `eid=10401`, ranked among the top pages by block count with `961` blocks.

## Search facets used

1. **Direct topic/title facet** — target page titles and wikilinks: `PARA`, `P.A.R.A.`, `Second Brain`, `Building a Second Brain`, `Tiago Forte`, `Forte Labs`.
2. **Method/process facet** — adjacent methods: `Just in Time Project Management`, `Progressive Summarization`, `The Process`, `digital gardening`.
3. **Reference hierarchy facet** — incoming `:block/refs` to title entities, plus ancestor and descendant expansion through `:block/parents` and `:block/children`.
4. **Corpus-level process facet** — derived `summary.edn`, `process-analysis.edn`, and `process-blocks.tsv` for counts and known process pages.

## Findings

1. **Canonical source is available locally** — The local archive exists at `/Users/joel/Code/joelhooks/egghead-roam-research`, with canonical EDN `/Users/joel/Code/joelhooks/egghead-roam-research/egghead-2026-01-19-13-09-38.edn`. Derived `summary.edn` reports `3,227,893` datoms, `215,971` distinct entities, `207,567` block strings, `5,612` titled pages, and `60,993` reference edges. This is big enough that shallow grep is the wrong tool. Source: `summary.edn`.

2. **The right Datalog helper scripts exist locally** — `scripts/query_ref_hierarchy.clj` loads the export with `datascript.db/db-from-reader`, resolves `:node/title`, finds incoming reference blocks via `:block/refs`, then prints page/title/eid/uid/year/page/refs and walks descendants sorted by `:block/order`. `scripts/query_term_context.clj` combines exact page-title refs with literal `:block/string` matches, then prints parents and descendant context. Source: `scripts/query_ref_hierarchy.clj`, `scripts/query_term_context.clj`.

3. **`Just in Time Project Management` is confirmed as a large, first-class page** — `summary.edn` lists `{:eid 10401, :title "Just in Time Project Management", :blocks 961}` among the top pages by block count. That is the strongest accessible evidence of Forte-adjacent material in this run. It should be treated as a page subtree, not a single note. Source: `summary.edn`, top pages by blocks.

4. **The archive has a large explicit process graph that likely overlaps with PARA/JITPM practice** — `process-analysis.edn` reports page `process` as `eid=10766`, with `289` process ref blocks, `273` process tag blocks, and `272` overlapping ref/tag blocks. Process refs peak in `2022` with `223` refs, then continue through 2025. Source: `process-analysis.edn`.

5. **Representative process evidence shows durable operational notes, not just personal PKM notes** — `process-blocks.tsv` includes entries like `ongoing research in roam #process` (`eid=161597`, page `August 10th, 2022`), `Moving a "todo list forward" in Roam #process` (`eid=157838`, page `August 1st, 2022`), and many concrete operating procedures around workshops, content processing, Sanity, ConvertKit, support, and publishing. This matters because PARA/Second Brain content may be embedded in operational process subtrees rather than isolated title pages. Source: `process-blocks.tsv`.

6. **Current accessible artifacts do not prove counts for `PARA`, `Second Brain`, `Tiago Forte`, `Forte Labs`, `Progressive Summarization`, `The Process`, or `digital gardening`** — those require executing the existing Datalog scripts against the EDN. The task specifically says not to rely on literal grep for `PARA`; with no shell/SSH execution tool available here, I did not fabricate counts. Source: tool limitation plus single-line 139MB EDN read failure.

## Exact next commands to get the full extent

Run from `/Users/joel/Code/joelhooks/egghead-roam-research`:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk PATH="/opt/homebrew/opt/openjdk/bin:$PATH" \
  clojure -M scripts/query_ref_hierarchy.clj \
  egghead-2026-01-19-13-09-38.edn \
  PARA 'P.A.R.A.' 'Second Brain' 'Building a Second Brain' \
  'Just in Time Project Management' 'Progressive Summarization' \
  'Tiago Forte' 'Forte Labs' 'The Process' 'digital gardening'
```

Then run term context for likely non-page literals:

```bash
for term in \
  'PARA' 'P.A.R.A.' 'Second Brain' 'Building a Second Brain' \
  'Just in Time Project Management' 'Progressive Summarization' \
  'Tiago Forte' 'Forte Labs' 'The Process' 'digital gardening'
do
  JAVA_HOME=/opt/homebrew/opt/openjdk PATH="/opt/homebrew/opt/openjdk/bin:$PATH" \
    clojure -M scripts/query_term_context.clj egghead-2026-01-19-13-09-38.edn "$term"
done
```

Required output fields per term:

- page title entity matches: `:node/title`, eid
- incoming reference block count: blocks with `:block/refs` to that page eid
- literal block count: `:block/string` case-insensitive term hits, excluding false positives for `PARA` like `separate` and `parameter`
- descendant count: unique descendants reached through `:block/children`
- representative roots with `eid`, `uid`, `year`, `page`, refs, ancestor path, and first 5-10 descendants

## Suggested implications for pi-notes replacing `Brain` with `./brain` served by SvelteKit

1. **Use a graph store/query layer, not markdown-only grep** — Roam history proves the valuable unit is often `page/ref root + ancestors + descendants`. `./brain` should preserve backlinks, refs, and block/subtree identity instead of flattening everything into files.

2. **Make reference hierarchy expansion a core Review Surface behavior** — A browser review page should let Joel select a concept like `PARA` or `Just in Time Project Management` and inspect incoming refs, ancestor context, and descendant blocks as one review batch.

3. **Treat process notes as reusable adapters** — The process corpus is operational and product-shaped. pi-notes should support adapters that turn old Roam process subtrees into SvelteKit/mdsvex review documents with source receipts.

4. **Do not clone Roam; keep the agent loop central** — The replacement should borrow graph refs, backlinks, progressive summaries, and source receipts, but make agents responsible for folding captures into canonical concepts and sending review batches through the Session Bridge.

## Sources

- Kept: `/Users/joel/.pi/agent/skills/roam-research-panda/SKILL.md` — gives the required read-only Roam/Datalog workflow and warns against shallow grep.
- Kept: `/Users/joel/Code/joelhooks/egghead-roam-research/AGENTS.md` — confirms canonical dataset and analysis contract.
- Kept: `/Users/joel/Code/joelhooks/egghead-roam-research/summary.edn` — confirms corpus size and `Just in Time Project Management` page `eid=10401`, `961` blocks.
- Kept: `/Users/joel/Code/joelhooks/egghead-roam-research/process-analysis.edn` — confirms process page/ref counts and timeline.
- Kept: `/Users/joel/Code/joelhooks/egghead-roam-research/process-blocks.tsv` — representative process evidence.
- Kept: `/Users/joel/Code/joelhooks/egghead-roam-research/scripts/query_ref_hierarchy.clj` — exact hierarchy expansion implementation.
- Kept: `/Users/joel/Code/joelhooks/egghead-roam-research/scripts/query_term_context.clj` — exact term context implementation.
- Dropped: literal EDN read via `functions.read` — the canonical EDN is a single 139MB line and the tool only returned a read failure suggesting shell `sed/head`; it was not usable for direct inspection.

## Gaps

- Missing authoritative counts for `PARA`, `P.A.R.A.`, `Second Brain`, `Building a Second Brain`, `Tiago Forte`, `Forte Labs`, `Progressive Summarization`, `The Process`, and `digital gardening`.
- Missing page-title/eid/uid inventory for those terms except `Just in Time Project Management`.
- Missing incoming-ref roots and expanded ancestor/descendant evidence.

Next step: rerun this task with shell/SSH execution enabled, then paste the Datalog outputs into this file as the final evidence table.