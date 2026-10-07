# T503: Done-when check, docs, close R094
**Status:** 📋 Todo
**Phase:** R094 — API reference from OpenAPI
**Size:** S (~1 hr)
**Depends on:** T502
**Covers:** S1, S2

## Goal
The epic's Done-when is checked end to end and written down: README mentions the API reference, MEMORY.md has the convention, the epic is done.

## Context
- Epic: `plans/roadmap/R094-api-reference-from-openapi.md`
- The site generates `/docs/tools/vibedoc_get_endpoint/` from `src/lib/mcp-tools.ts`; nothing to add there by hand.

## Scope
- [ ] Done-when walk: example spec project → /docs lists endpoints; `vibedoc_get_endpoint` returns request + response shape (`e2e/api-reference.mjs` also calls the tool over `/api/mcp`)
- [ ] README feature list: one line on the API reference
- [ ] `memory/MEMORY.md` Key conventions: one R094 bullet
- [ ] Epic `**Status:** done`

**Out of scope:** new features.

## Files
- `README.md`, `memory/MEMORY.md`, `plans/roadmap/R094-api-reference-from-openapi.md`, `e2e/api-reference.mjs` (MCP check if missing)

## Acceptance criteria
- [ ] `e2e/api-reference.mjs` covers /docs and `vibedoc_get_endpoint` and passes
- [ ] `pnpm lint && pnpm build` pass

## Verify
```bash
node src/lib/openapi.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3194 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/api-reference.mjs
```

## Manual tests
- [ ] S1 — WHEN a project keeps an openapi.yaml and the user opens /docs → THEN its endpoints show
- [ ] S2 — WHEN an agent calls `vibedoc_get_endpoint` → THEN it gets the request and response shape
