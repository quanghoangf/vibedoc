# T380: Ranked doc search over cached files
**Status:** 📋 Todo
**Phase:** R088 — Docs quality gate
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S3

## Goal
`searchDocs` ranks whole files by where the query words appear (title > heading > body) instead of counting substring hits line by line, and repeated searches don't re-read unchanged files. The search box on /docs and `vibedoc_search_docs` get the better order for free.

## Context
- Epic: `plans/roadmap/R088-docs-quality-gate.md`
- Decided: reuse `tokenize` from `src/lib/recall.ts` (stopwords + plural strip); keep the `SearchResult` shape (`{file, hits: {line, text}[], totalHits}`); no vector search.
- Decided: one mtime cache for every .md read. `getDocGraph()` already keeps one (`docGraphCache` in core.ts); extend it to also hold the raw text, so search and lint (T381) reuse it.
- CLAUDE.md: "Never import `fs` outside of `src/lib/core.ts`". Pure libs import each other only with `import type` (the `.check.mts` files run without a bundler), so core passes `tokenize` into the pure ranker.

## Scope
- [ ] `readMarkdownFiles(root)` in core.ts: glob `**/*.md` (same ignore list), mtime cache holding `{mtimeMs, raw, item}`; `getDocGraph()` uses it (behaviour unchanged).
- [ ] Pure `src/lib/doc-search.ts`: `rankDocs(files: {path, raw}[], query, tokenize)` → `SearchResult[]` sorted by score, then path. Per unique query token: +3 if in the title (H1, else file name), +2 if in any heading, +1 if in the body. Score 0 dropped. `hits` = first 4 lines containing a query token (trimmed, ≤120 chars), `totalHits` = number of such lines. A query with no tokens (only stopwords) falls back to the old substring match.
- [ ] `searchDocs()` in core.ts calls it; limit 20 as before.
- [ ] `src/lib/doc-search.check.mts` (assert-based, like `recall.check.mts`).

**Out of scope:** lint (T381), UI changes (T383).

## Files
- `src/lib/core.ts` — `readMarkdownFiles`, `getDocGraph`, `searchDocs`
- `src/lib/doc-search.ts` — new, pure
- `src/lib/doc-search.check.mts` — new

## Implementation notes
- `getDocGraph` at core.ts ~2725: bump `DOC_GRAPH_CACHE_VERSION` since the cached value shape changes.
- `memoryGraphFiles` / `getSpecContext` also read every .md; leave them (their ponytail notes already name the upgrade).

## Acceptance criteria
- [ ] A doc whose title contains the query words ranks above a doc that only mentions them in its body many times (check).
- [ ] A second search with no file changed re-reads 0 files (the `doc graph: read N` log stays silent).
- [ ] `vibedoc_search_docs` output format is unchanged.

## Verify
```bash
node src/lib/doc-search.check.mts
node src/lib/doc-links.check.mts
pnpm lint && pnpm build
```
