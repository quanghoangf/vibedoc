# T099: Hover preview for doc links
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** S (~1–1.5 hrs)
**Depends on:** T094, T095
**Done:** 2026-10-01

## Goal
Resting the mouse on a link to another file shows its title and opening lines, so readers can decide whether to follow it without leaving the doc.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- Links in the preview are resolved by T094 (delegated handlers in `MarkdownRenderer`). Panel rows come from T095 (`LinkedDocs`).
- File content: `GET /api/docs?read=<path>` (used by `openDoc`). Tasks: `/api/tasks`. Entries: `/api/memory/entries`.

## Scope
- [x] `src/components/docs/LinkPreview.tsx`: a floating card with kind icon, title, path, and the first ~400 chars of rendered text (frontmatter and H1 stripped, plain text only). For a task, show status and owner.
- [x] Trigger: delegated `mouseover` after a ~350 ms delay, on resolved links in `MarkdownRenderer` and on `LinkedDocs` rows. It hides on mouseleave, but stays open while the pointer is over the card. Keyboard focus shows it too.
- [x] Cache fetched previews in a module-level `Map` for the session, cleared on SSE `doc_updated`.
- [x] Broken links show "Not found" in the card, with no fetch.

**Out of scope:** previews on /graph nodes, editing from the card.

## Files
- `src/components/docs/LinkPreview.tsx`: new
- `src/components/docs/MarkdownRenderer.tsx`, `src/components/docs/LinkedDocs.tsx`: wire the trigger

## Implementation notes
- Place the card with plain `getBoundingClientRect()` and flip it above the link near the bottom edge. Don't add a popover library. Check first whether the shadcn `ui/` folder already has a hover-card or popover that fits, and reuse it if so.
- Strip markdown roughly (drop `#`, `*`, links → text). A perfect render isn't needed.

## Acceptance criteria
- [x] Hovering a doc link in HLD.md for ~0.4 s shows the target's title and first lines. Moving away hides it.
- [x] Hovering the same link again shows it immediately from the cache, with no request.
- [x] Panel rows show the same preview.
- [x] A broken link shows "Not found".
- [x] Tab focus on a link shows the card.

## Verify
```bash
pnpm build && pnpm lint
# /docs?doc=docs/architecture/02-high-level-design/HLD.md — hover links and Linked docs rows
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open /docs?doc=docs/architecture/mcp-tools.md and rest the mouse on the ADR-005 link for about half a second → a card shows the ADR icon, its title, its path and the opening lines as plain text
- [ ] Move the mouse away → the card hides; hover the same link again → the card shows at once (Network tab: no new /api/docs?read= request)
- [ ] Hover a link to a task (e.g. a [[T094]] wikilink or a plans/tasks link) → the card also shows the task's status and owner
- [ ] Hover a broken link (dashed underline) → the card says "Not found" with the raw target, and no request is sent
- [ ] Press Tab until a doc link is focused → the card shows; Tab away → it hides
- [ ] Open the Linked docs panel (link icon in the doc bar) and hover a row, then move onto the card → the same preview shows and stays open while the pointer is on the card; a Broken row shows "Not found"
### Regression risk
- [ ] Clicking links in the preview and rows in the Linked docs panel still opens the target (doc, task on /board, epic on /roadmap)
- [ ] Edit the linked doc and hover its link again → the card shows the new text (cache cleared on doc_updated)
