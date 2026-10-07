# T481: Record searches that found nothing
**Status:** ✅ Done
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Done:** 2026-10-07
**Phase:** R093 — Doc usage signals
**Size:** S (~1–2 hrs)
**Depends on:** T480
**Covers:** S3

## Goal
An agent's `vibedoc_search_docs` that returns nothing is recorded, and /docs shows it under "Searched, not found", so the user knows which docs agents looked for and couldn't find.

## Context
- Epic: `plans/roadmap/R093-doc-usage-signals.md`
- Recorded at the MCP call site (`case "vibedoc_search_docs"`), never inside `searchDocs` (R088 is rewriting its ranking).
- Queries coalesce by normalized key (trim + lowercase + collapsed spaces): `{query, count, last}`; capped at 100, oldest dropped. A later search for the same key that finds results removes it.
- Human searches on /docs (`GET /api/docs?q=`) never count.

## Scope
- [ ] `src/lib/doc-usage.ts`: `recordSearch(usage, query, found, now)`; summary gains `notFound` (most recent first); check file cases
- [ ] core.ts `noteDocSearch(root, query, found)`; MCP call site fire-and-forget + `emitUpdate("doc_usage_updated")`
- [ ] `DocUsage.tsx`: "Searched, not found" list (query, count, last time); i18n en + vi
- [ ] Extend `e2e/doc-usage.mjs` with S3 and the epic's Done-when (after a session: the read doc and the empty search both show)

**Out of scope:** human searches, suggestions for which doc to write.

## Files
- `src/lib/doc-usage.ts`, `src/lib/doc-usage.check.mts`
- `src/lib/core.ts` (R093 block), `src/app/api/mcp/route.ts`
- `src/components/docs/DocUsage.tsx`, `src/i18n/docs.ts`, `e2e/doc-usage.mjs`

## Acceptance criteria
- [ ] `vibedoc_search_docs {query: "zzz nothing"}` twice → one entry with count 2 under "Searched, not found", live
- [ ] Writing a doc that matches, then the same search → the entry is gone
- [ ] `node src/lib/doc-usage.check.mts` and `e2e/doc-usage.mjs` pass

## Verify
```bash
node src/lib/doc-usage.check.mts
pnpm build && pnpm lint
PORT=3193 pnpm dev   # then:
BASE=http://localhost:3193 node e2e/doc-usage.mjs
```

## Manual tests
### Steps
- [x] S3 — WHEN an agent's `vibedoc_search_docs` returns no results → THEN /docs lists that query under "Searched, not found", and it leaves the list once the same search finds a doc
- [ ] Open /docs with no doc selected → "Searched, not found" spans the width under the two read lists; a long query truncates instead of wrapping
- [ ] Search in the /docs list for something that doesn't exist → nothing is added to "Searched, not found" (only agent searches count)
### Regression risk
- [ ] An agent's `vibedoc_search_docs` that finds docs still returns the same hits as before
