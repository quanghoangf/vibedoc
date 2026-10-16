# T550: Search across projects (API and agents)
**Status:** 📋 Todo
**Phase:** R107 — Cross-project search
**Size:** M (2–3 hrs)
**Depends on:** T538
**Covers:** S1

## Goal
One search runs over docs, tasks, epics and memory entries of every hub project or one group, and agents can search their group from any member repo.

## Context
- Epic: `plans/roadmap/R107-cross-project-search.md`
- Reuse ranking: docs via `searchDocs(query, root)` (pure `rankDocs` in `src/lib/doc-search.ts`), entries via `recallEntries` / `rankEntries` (`src/lib/recall.ts`), tasks/epics by title + id with the same `tokenize`. No vector search (by design, R048).
- Result: `{project: {id,name}, kind: doc|task|epic|entry, id|path, title, snippet, score}`, grouped by project, top 10 per project, 50 total.
- Scope: `all` (hub, archived skipped) or `group:<slug>`.
- MCP: `vibedoc_search_docs` gains `scope: "project" | "group"` (default project, output unchanged); group results prefix `[api]`. Doc usage recording (R093) stays per project.

## Scope
- [ ] Pure `mergeResults` in `src/lib/doc-search.ts` or new `src/lib/cross-search.ts` (+ check)
- [ ] core `searchAll(query, scope)`; `GET /api/search?q=&scope=`
- [ ] MCP `vibedoc_search_docs` `scope` arg (`mcp-tools.ts` + `route.ts` ~line 322)

**Out of scope:** the UI (T551); searching code.

## Files
- `src/lib/cross-search.ts`, `src/lib/cross-search.check.mts` — new
- `src/lib/core.ts`, `src/app/api/search/route.ts` — new
- `src/lib/mcp-tools.ts`, `src/app/api/mcp/route.ts`

## Acceptance criteria
- [ ] "rate limit" from `web` with scope group finds `api`'s decision doc (epic Done when)
- [ ] `vibedoc_search_docs` without `scope` returns exactly today's output
- [ ] `node src/lib/cross-search.check.mts` passes

## Manual tests
- [ ] S1 — WHEN the user searches a term that only appears in project B while in project A → THEN the result shows B's doc and opens it in B

## Verify
```bash
node src/lib/cross-search.check.mts
pnpm lint && pnpm build
curl -s 'localhost:3081/api/search?q=rate%20limit&scope=all'
```
