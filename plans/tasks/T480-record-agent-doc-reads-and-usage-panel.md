# T480: Record agent doc reads and show them on /docs
**Status:** ✅ Done
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Done:** 2026-10-07
**Phase:** R093 — Doc usage signals
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1, S2

## Goal
Every `vibedoc_read_doc` call is counted in `.vibedoc/doc-usage.json`, and the /docs landing page (no doc open) shows "Read by agents" (most read first) and "Never read by agents". The thin end-to-end slice of the epic.

## Context
- Epic: `plans/roadmap/R093-doc-usage-signals.md`
- Storage is `.vibedoc/doc-usage.json`, written only via `core.ts`, coalesced per doc (`{count, last}`), bounded (cap entries, drop the oldest `last`). It is a new VibeDoc write: add it to CLAUDE.md's "VibeDoc writes only …" list.
- Only agent reads count: MCP `vibedoc_read_doc`. Human opens (`GET /api/docs?read=`) never count.
- The in-app chat's calls (header `x-vibedoc-chat`, `CHAT_CALL_HEADER`) count too: the chat's `claude -p` is an agent reading docs, which is what this epic measures. (R081 skips them only for "is the user's agent connected" evidence.)
- R088 is rewriting `searchDocs`; record at the MCP call site, never inside core's read/search functions.
- CLAUDE.md: "Never import `fs` outside of `src/lib/core.ts`", "Always call `emitUpdate()` after any mutation", "No hardcoded UI text … `src/i18n/<area>.ts` (en + typed vi)". Demo (`isDemo()`) writes nothing, like `recordAgentCall`.

## Scope
- [ ] Pure `src/lib/doc-usage.ts`: `parseUsage`, `recordRead`, `summarizeUsage` + `src/lib/doc-usage.check.mts`
- [ ] core.ts (new `// ─── R093` block at the end): `readDocUsage`, `noteDocRead` under a per-process lock, `getDocUsage(root)` (summary over `listDocs`)
- [ ] MCP `vibedoc_read_doc`: after a successful read, record the resolved path fire-and-forget, then `emitUpdate("doc_usage_updated")`
- [ ] `GET /api/docs/usage` → the summary
- [ ] `components/docs/DocUsage.tsx` in the DocViewer empty state (only when the project has files); refetch on the `doc_usage_updated` SSE event; click a path opens it
- [ ] i18n keys in `src/i18n/docs.ts` (en + vi); CLAUDE.md writes list
- [ ] `e2e/doc-usage.mjs` for S1, S2

**Out of scope:** zero-result searches (T481), human page views, anything off the machine.

## Files
- `src/lib/doc-usage.ts`, `src/lib/doc-usage.check.mts` — new
- `src/lib/core.ts` — append R093 block; copy `recordAgentCall`'s tmp + rename write
- `src/app/api/mcp/route.ts` — `case "vibedoc_read_doc"`
- `src/app/api/docs/usage/route.ts` — new
- `src/components/docs/DocUsage.tsx` — new; `DocViewer.tsx` / `DocsTab.tsx` — render it, pass `onDocSelect`
- `src/i18n/docs.ts`, `CLAUDE.md`, `e2e/doc-usage.mjs`

## Implementation notes
- Shape: `{ version: 1, reads: { [path]: { count, last } }, searches: { [key]: { query, count, last } } }` (searches filled by T481). Caps: 500 reads, 100 searches.
- "Never read" = `docNode(path, "").kind === "doc"` docs with no read entry (same filter DocsTab uses for its doc count), so tasks/epics/entries don't flood it. "Read by agents" lists only paths that still exist.
- Pure libs never import values from each other (`node *.check.mts` runs without a bundler).

## Acceptance criteria
- [ ] Two `vibedoc_read_doc` calls for one doc → its count is 2 in `.vibedoc/doc-usage.json`; a failed read records nothing
- [ ] /docs (no doc open) shows the doc under "Read by agents" with 2 reads, live after the MCP call
- [ ] A doc nobody read is under "Never read by agents"; a human opening it does not move it
- [ ] `node src/lib/doc-usage.check.mts` passes; `e2e/doc-usage.mjs` passes

## Verify
```bash
node src/lib/doc-usage.check.mts
pnpm build && pnpm lint
PORT=3193 pnpm dev   # then:
BASE=http://localhost:3193 node e2e/doc-usage.mjs
```

## Manual tests
### Steps
- [x] S1 — WHEN an agent reads a doc with `vibedoc_read_doc` → THEN /docs lists that doc under "Read by agents" with its read count, without a reload
- [x] S2 — WHEN a doc in the project has never been read by an agent → THEN /docs lists it under "Never read by agents"
- [ ] Open /docs with no doc selected → a "Doc usage by agents" section sits under the "N docs" heading, two columns on desktop
- [ ] Switch the language to Tiếng Việt → the section and its lists read in Vietnamese
### Regression risk
- [ ] Open a doc, edit and save it → the editor still saves; the landing's ⌘P / ⌘K hints still show
