# T511: Sidebar pages with collapsible children: recent and needs-action items
**Status:** 🔨 In progress
**Phase:** R095 — UI enhancements
**Size:** L (half a day)
**Covers:** S8

## Goal
The sidebar's page links (Board, Roadmap, Manual tests, Activity, Docs, Memory, Explorer, Graph) are flat: a count at most, then you land on the page and search again. Let each page expand into a few child items — the things that **need your action** there first, then what you **recently viewed or used** — and collapse back. One click from the sidebar reaches the exact task, epic, doc or entry you were on or have to deal with. Design it with `/impeccable` (shape the IA and density before building).

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Sidebar: `src/components/layout/AppSidebar.tsx` — `NAV_GROUPS` (lines 30-48), counts per href (`testsNeedYou` via `countNeedsYou` in `src/lib/test-review.ts`, board counts, lines 68-75). Chats already show children above it: `SidebarChats.tsx` with `groupChats()` (`needsYou → errors → running → recent`, `src/lib/chats.ts:184`) — the same "needs you first, then recent" pattern this task extends to the pages.
- Needs-action sources that already exist (derived, nothing new stored):
  - Board / Manual tests: tasks in review, failed run, blocked (`countNeedsYou`, `reviewHold`)
  - Roadmap: drift / at-risk / overdue epics (`roadmapHealth()` in `src/lib/roadmap-health.ts`, already in AppContext via `board` + roadmap)
  - Docs: lint errors (R088 `summary` / `/api/docs/lint`), "may be outdated" docs (R092)
  - Memory: cleanup flags (`memory/.cleanup.json`)
- Recent items: there's no view log. Keep it per browser, no `localStorage` (CLAUDE.md): a cookie like `vibedoc-last` (`src/lib/first-screen.ts:30`), e.g. `vibedoc-recent` holding the last ~5 item refs per page (`T216`, `R066`, `docs/x.md`, `E012`), written where items are opened (task panel, roadmap item, `openDoc`, memory entry). Ids only, never content. Optionally merge in the human's own recent activity-log events (`src/lib/activity.ts`) so "used" counts too.
- Deep links already exist: `/board?task=`, `/roadmap?item=`, `/docs?doc=` / `openDoc`, `/memory?entry=`, `/manual-tests?task=` (T507 `testReviewHref`).
- Collapse state per group/page: same cookie approach (`vibedoc-sidebar`), default expanded only for the current page and pages with needs-action items.
- Live: AppContext refreshes on SSE, so needs-action children update without reload.
- UI text in `src/i18n/shell.ts` (en + vi). The sidebar's collapsed (icon-only) mode must keep working.
- Run `/impeccable` (shape → craft) on the sidebar before coding; record its decisions (max children per page, labels, how needs-action vs recent are marked, empty states) in the task report.

## Scope
- [ ] Pure `src/lib/sidebar-items.ts` (+ `.check.mts`): given the board, roadmap health, doc lint summary, memory flags and the recent refs, return per page up to N children `{ ref, label, reason: 'needs-action' | 'recent', hint }`, needs-action first, deduped, deleted items dropped
- [ ] Recent tracking: `src/lib/recent-items.ts` (cookie encode/decode, cap, pure + check); record on open of a task, epic, doc, memory entry
- [ ] Sidebar: each page row gets a disclosure chevron when it has children; children render indented with an icon/status mark and a short reason (e.g. "Review", "Overdue", "2 lint errors", "Viewed"); clicking opens the item via its deep link
- [ ] Collapsible per page, state remembered in a cookie; keyboard: ←/→ collapse/expand on a focused row, Enter opens
- [ ] Icon-only sidebar: children hidden, the page icon shows a dot when it has needs-action items
- [ ] Apply the `/impeccable` direction (hierarchy between page row and children, density, motion respecting reduced motion)

**Out of scope:** the Chats section (already has children), new needs-action rules, syncing recents across browsers

## Files
- `src/lib/sidebar-items.ts`, `src/lib/sidebar-items.check.mts` — new
- `src/lib/recent-items.ts`, `src/lib/recent-items.check.mts` — new
- `src/components/layout/AppSidebar.tsx` (+ a `SidebarPageChildren.tsx` if it grows)
- Open points that record recents: `TaskDetailPanel.tsx`, `RoadmapTab.tsx` (`setSelectedId`), `AppContext.openDoc`, memory `EntryDetail`
- `src/i18n/shell.ts`
- `e2e/sidebar-children.mjs` — new; copy setup from `e2e/first-week.mjs`

## Acceptance criteria
- [ ] With a task in review and an overdue epic, Board / Manual tests show that task and Roadmap shows that epic as children marked as needing action, without opening the pages
- [ ] Open T216 and docs/x.md → they appear as recent children under Board and Docs; reload → still there
- [ ] Click a child → lands on that exact item (panel/sheet/doc/entry open)
- [ ] Collapse Board → children hidden; reload → still collapsed; ←/→ and Enter work
- [ ] Approving the task elsewhere removes it from needs-action live (SSE)
- [ ] Icon-only sidebar shows a dot on pages with needs-action items; light + dark; Vietnamese labels; 390px drawer works
- [ ] `pnpm build` passes; both `.check.mts` pass; no new lint errors

## Verify
```bash
node src/lib/sidebar-items.check.mts
node src/lib/recent-items.check.mts
pnpm build
PORT=3195 pnpm dev   # separate terminal
BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright node e2e/sidebar-children.mjs
```

## Manual tests
### Steps
- [ ] S8 — WHEN the user expands a page in the sidebar → THEN its children list what needs action there first, then recently viewed items, and each opens the exact item
- [ ] The sidebar still reads calmly with several pages expanded (visual check after /impeccable)
### Regression risk
- [ ] The Chats section and the sidebar's icon-only mode behave as before
