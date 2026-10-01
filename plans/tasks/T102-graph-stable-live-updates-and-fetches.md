# T102: Graph keeps the camera on live updates; one fetch; error state
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T101
**Done:** 2026-10-01

## Goal
An agent moving tasks no longer yanks the graph out from under the user. Today every SSE event in LINK_EVENTS refetches, rebuilds positions and calls fitView, losing pan/zoom (critique P1, "solo dev supervising agents").

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md`. Code: `src/components/graph/DocGraph.tsx` (fetch ~:106–124, fitView ~:150–157), `src/components/docs/useDocLinks.ts` (LINK_EVENTS :10).
- Detector evidence: `/api/docs/graph` requested twice per /graph load; `/api/docs/links` three times per doc open.

## Scope
- [ ] Re-layout only when the **visible id set or edge set** actually changed (compare a sorted key, not object identity). Same data → no relayout, no fitView.
- [ ] fitView only on first load, on filter/focus change, or when the visible set grows/shrinks — and never after the user has panned/zoomed (track a `userMoved` flag from user-initiated onMoveStart; reset on filter/focus change or a "Fit" control).
- [ ] Remember which node ids changed in the last refresh (new/removed edges or changed task status) and expose them for T105's update flash (e.g. `changedIds` state, cleared after ~1.5s).
- [ ] Selection hidden by a filter: keep it in the URL, show a muted line in the card area: "<label> is hidden by filters · Show" (Show turns on its kind).
- [ ] Fetch errors get their own state: "Couldn't load the link graph." + error message + Retry (not the "No links yet" empty copy).
- [ ] De-duplicate requests: one `/api/docs/graph` per load/SSE burst (debounce SSE refetch ~250ms, abort stale), one `/api/docs/links` per doc open (fix the triple fetch in useDocLinks/DocViewer/LinkedDocs — share one hook instance or a module cache keyed by root+path).

**Out of scope:** visuals (T103), animation of the relayout (T105).

## Acceptance criteria
- [ ] Pan/zoom, then trigger `POST /api/tasks`-level change (e.g. update a task status via MCP) → graph data refreshes, camera does not move.
- [ ] Network panel: /graph load = 1 graph request; opening a doc = 1 links request; 5 SSE events within 200ms = 1 refetch.
- [ ] Stopping the API (or forcing a 500 in dev) shows the error state with Retry, which recovers.
- [ ] Selected node filtered out → message with Show; Show restores it.

## Verify
```bash
pnpm build && pnpm lint
# Playwright: count requests per load; pan then emit an SSE-producing change and assert viewport unchanged
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open `/graph`, drag the canvas and zoom in a step, then move any task to another status from `/board` in a second tab (or `vibedoc_update_task`) → the graph refreshes but the camera stays exactly where you left it
- [ ] With the camera moved, create a doc that links to an existing doc → the new dot appears, the camera does not jump; press the Fit control (bottom-left) → the graph fits again
- [ ] Open DevTools Network, reload `/graph` → exactly one `/api/docs/graph` request; open a doc on `/docs` → exactly one `/api/docs/links` request
- [ ] Select a doc on `/graph`, then turn Docs off in the kind chips → top-right reads "<doc title> is hidden by filters · Show"; click Show → Docs turns back on and the selection card returns
- [ ] Block `/api/docs/graph` in DevTools (Network request blocking) and reload `/graph` → "Couldn't load the link graph." with the error and a Retry button; unblock and press Retry → the graph loads
### Regression risk
- [ ] `/docs` Linked docs panel and broken-link marks still update after editing a doc (links now come from a shared per-burst cache)
- [ ] Search Enter / arrow-key moves on `/graph` still centre the node; a later live update must not re-fit away from it
