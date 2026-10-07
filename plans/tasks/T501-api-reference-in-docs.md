# T501: API reference view in /docs
**Status:** 📋 Todo
**Phase:** R094 — API reference from OpenAPI
**Size:** L (half a day)
**Depends on:** T500
**Covers:** S1, S4

## Goal
A project with an OpenAPI spec shows an "API reference" entry in /docs; opening it lists the endpoints grouped by tag, and opening one shows its parameters, request body and responses with schemas.

## Context
- Epic: `plans/roadmap/R094-api-reference-from-openapi.md`
- Decisions from the breakdown:
  - Data: `GET /api/openapi?root=` → `{ path, endpoints }` (or `{ path: null }` with no spec, `{ path, error }` on a parse error); `GET /api/openapi?root=&method=&path=` → the endpoint detail (T500's `endpointDetail`, with `schemaShape` text per schema). Read-only, no emitUpdate.
  - UI state is the URL: `/docs?api=1` opens the reference, `/docs?api=GET%20/todos/{id}` an endpoint (written with `history.replaceState` like the board views). Opening a doc clears it.
  - Placement: an "API reference" row at the top of `DocList` (only when a spec exists); the right pane renders `ApiReference` instead of `DocViewer` while `api` is set. Keep the edits to `DocList` / `DocsTab` / docs page minimal (other epics touch them): the view lives in new files.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`)"; "Never use `localStorage`"; Tailwind only.

## Scope
- [ ] `src/app/api/openapi/route.ts` (GET)
- [ ] `src/components/docs/ApiReference.tsx` (new): endpoint list (tag groups, method badge, path, summary) + detail (parameters: name, in, required, shape, description; request body: content type + shape; responses: status, description, shape); a parse error shows the message; phone width works
- [ ] `DocList` row "API reference" (+ endpoint count) when `/api/openapi` has a path; docs page wires `?api`
- [ ] i18n keys in a new `src/i18n/apiRef.ts` (en + vi), merged in `src/i18n/index.ts`
- [ ] `e2e/api-reference.mjs` (new, style of `e2e/first-week.mjs`): fixture with `examples/openapi/openapi.yaml` copied in → /docs shows the row, list grouped by tag, open `GET /todos/{id}` shows params + 200 shape; fixture without a spec → no row; no console errors

**Out of scope:** Try it (T502), editing the spec, search inside the reference.

## Files
- `src/app/api/openapi/route.ts`, `src/components/docs/ApiReference.tsx`, `src/i18n/apiRef.ts`, `e2e/api-reference.mjs` — new
- `src/components/docs/DocList.tsx`, `src/components/docs/DocsTab.tsx`, `src/app/(app)/docs/page.tsx` — the row + pane switch only
- `src/i18n/index.ts`

## Implementation notes
- Method badge colours from existing tokens in `globals.css`, no new palette.
- Mark spec content (summaries, descriptions, paths) `data-user-content` so `e2e/i18n.mjs` doesn't flag it.

## Acceptance criteria
- [ ] With the example spec, /docs shows "API reference" and every endpoint grouped by tag; an endpoint shows params, body and responses with the resolved schema fields
- [ ] Without a spec, no row and no request errors
- [ ] `e2e/api-reference.mjs` passes; `node src/lib/i18n.check.mts` passes

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3194 pnpm dev &   # then:
BASE=http://localhost:3194 node e2e/api-reference.mjs
```

## Manual tests
- [ ] S1 — WHEN a project keeps an openapi.yaml and the user opens /docs → THEN an "API reference" entry lists every endpoint grouped by tag, and one endpoint shows its parameters, body and responses
- [ ] S4 — WHEN the project has no OpenAPI spec → THEN /docs shows no API reference entry
