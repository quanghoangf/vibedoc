# T522: Doc link mini graph
**Status:** 👀 Review
**Owner:** ai:claude
**Started:** 2026-10-12
**Done:** 2026-10-12
**Phase:** R097 — Diagrams from project data
**Size:** M (2–3 hrs)
**Depends on:** T520
**Covers:** S3

## Goal
A doc shows its neighbourhood as a small picture: docs linking to it on the left, the doc in the middle, docs it links to on the right, clickable — so you see how a doc connects without reading the Linked docs lists.

## Context
- Epic: `plans/roadmap/R097-diagrams-from-project-data.md`
- Data: `useDocLinks(path)` (`src/components/docs/useDocLinks.ts`) → `{ out, in, broken, stale, targets }`, already refetched per SSE burst (`useLinkGeneration`). Same data as `LinkedDocs` (`DocViewer.tsx:145,211`).
- Reuse T520's `item-diagrams.ts` + `<DerivedDiagram>`. Node shape by kind like /graph (doc · task · epic · entry · spec); broken links as dashed nodes; cap 8 per side + "+N more" that opens `/graph?node=<path>&focus=1` (`graphHref`).
- Placement: at the top of the `LinkedDocs` panel (desktop side panel and the phone sheet), not in the reading column. No links at all → nothing.
- Node click → `openDoc(path)` (tasks/epics open their own place like LinkedDocs does).

## Scope
- [ ] `item-diagrams.ts`: `docLinkGraph(path, links, cap)` + mermaid output; check cases (in only, out only, both, broken, cap)
- [ ] `LinkedDocs.tsx`: diagram on top; i18n en + vi in `src/i18n/docs.ts`
- [ ] `e2e/derived-diagrams.mjs`: S3 section — fixture doc with 2 inbound and 1 outbound link → 4 nodes; click the outbound one opens it

**Out of scope:** replacing /graph, multi-hop doc graphs.

## Files
- `src/lib/item-diagrams.ts`, `src/lib/item-diagrams.check.mts`, `src/components/docs/LinkedDocs.tsx`, `src/i18n/docs.ts`, `e2e/derived-diagrams.mjs`

## Acceptance criteria
- [ ] A linked doc shows the graph in the Linked docs panel; an unlinked doc shows none
- [ ] Clicking a node navigates; "+N more" goes to /graph focused on the doc
- [ ] Check + e2e pass; `pnpm build` ok, no new lint errors

## Verify
```bash
node src/lib/item-diagrams.check.mts
pnpm build && pnpm lint
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/derived-diagrams.mjs
```

## Manual tests
_Auto: `e2e/derived-diagrams.mjs` passed 2026-10-12 (items below marked [x] are what it proved). `item-diagrams` + `i18n` checks, `pnpm build` ok, lint 10 errors (baseline); `docs-links` (locators scoped to the list rows, the map names the same files) and `visual-docs` e2e pass._

_Notes: top to bottom (inbound above, the doc, outbound + broken below), not left to right: the panel is an 18rem column and three columns didn't fit. Labels cut at 20 characters. Shape by kind wasn't needed: items show their id (`T001 · …`)._
### Steps
- [x] S3 — WHEN a doc is opened → THEN a small graph shows the docs linking to it and the docs it links to
- [ ] Phone width: the Linked docs sheet shows the graph without horizontal scroll
