# T095: Linked docs panel (links to / linked from / broken)
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T093
**Done:** 2026-10-01

## Goal
While reading a doc you always see what it links to and what links to it, each one click away. This replaces the hover-only "Referenced by" popover, which has no outgoing links and gives false matches.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- Data comes from `GET /api/docs/links?path=` (T093), through the `useDocLinks` hook if T094 already added it. If not, add it in `src/components/docs/` here.
- Today: `src/components/docs/BacklinksPanel.tsx` is a `Link2` icon with a hover popover in the doc bar (`DocViewer.tsx:134-140`, `barEnd`). The docs page has no right column. The outline and backlinks are both popovers.
- Kind icons and status icons are in `src/components/memory/EntryRelated.tsx` (`KIND_ICON`, :18), and node opening is in `useOpenNode` (:21). Reuse them.
- Rules: Tailwind only, no `localStorage`.

## Scope
- [ ] `src/components/docs/LinkedDocs.tsx` (new) has three sections:
  - **Links to**: grouped Docs / ADRs / Tasks / Epics / Entries, with kind icon and label, and the task status icon.
  - **Linked from**: same grouping, plus the source line (`L12 · text…`).
  - **Broken**: the raw target and line, shown only when there are any.
  - Each section shows its count. Empty states: "No links yet" / "Nothing links here".
- [ ] Layout at ≥xl: a right column next to the preview (`w-72`, sticky, its own scroll). Below xl: the doc-bar `Link2` button (with the in+out count) opens the same content as a sheet or popover on click, not on hover.
- [ ] Show/hide the right column with a toggle in the doc bar. The state lives in component state, not `localStorage`.
- [ ] Rows open their targets with `useOpenNode`.
- [ ] Refresh live when the doc or any doc changes (SSE `doc_updated`).
- [ ] Delete `BacklinksPanel.tsx`. `findBacklinks` stays until T096.

**Out of scope:** hover preview on rows (T099), a local graph, MCP (T096).

## Files
- `src/components/docs/LinkedDocs.tsx`: new
- `src/components/docs/DocViewer.tsx`: right column + doc-bar button. Remove the `BacklinksPanel` import.
- `src/components/docs/BacklinksPanel.tsx`: delete
- `src/components/memory/EntryRelated.tsx`: export `KIND_ICON` / `useOpenNode` if needed (or move them to `components/shared/`)

## Implementation notes
- Follow the look of `EntryRelated` (R053) so the Memory and Docs panels match. Same grouping order and same row style.
- The preview is centred at `max-w-[72ch]`. Put the column outside that box so the reading width does not shrink.

## Acceptance criteria
- [ ] Opening HLD.md at ≥xl width shows Links to (its outgoing docs) and Linked from (docs that link to it, with line numbers). Clicking any row opens it.
- [ ] A doc whose name is only mentioned as text (not linked) on another file's line is **not** listed. This is the old false positive.
- [ ] Below xl, the doc-bar button with its count opens the same lists on click.
- [ ] Adding a link to a doc in another tab updates the panel without a reload.
- [ ] No `BacklinksPanel` left in src (`grep -r BacklinksPanel src` is empty).

## Verify
```bash
pnpm build && pnpm lint
grep -r BacklinksPanel src || echo gone
# open /docs?doc=docs/architecture/02-high-level-design/HLD.md at full width, then at ~1000px
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Open /docs?doc=docs/architecture/02-high-level-design/HLD.md in a window at least 1280px wide → a right column shows Links to and Linked from, each with a count, grouped (Tasks, Docs, …); Linked from rows show `L<n> · text`
- [ ] Click a row in Linked from (e.g. a task) → that task opens on /board; go back and click a doc row → that doc opens in Docs
- [ ] Click the link button (🔗 with the count) in the doc bar → the right column hides; click it again → it comes back
- [ ] Narrow the window below 1280px → the column is gone; click the doc-bar link button → a sheet opens from the right with the same lists; clicking a row opens it and closes the sheet
- [ ] In another tab, edit a doc to add `[x](docs/architecture/02-high-level-design/HLD.md)` and save → the first tab's Linked from list gains that doc without a reload
- [ ] Open a doc with a link to a missing file → a Broken section lists the raw target and its line; a doc that only mentions another file's name as plain text is not listed under Linked from
### Regression risk
- [ ] Split and Edit modes still lay out correctly with the column open (editor, preview and column side by side), and the Outline popover still works
