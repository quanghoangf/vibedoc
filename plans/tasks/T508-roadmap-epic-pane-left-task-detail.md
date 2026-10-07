# T508: Roadmap epic pane on the left, task detail fills the rest
**Status:** 👀 Review
**Phase:** R095 — UI enhancements
**Size:** L (half a day)
**Covers:** S5

## Goal
On /roadmap, opening an epic slides a 480px sheet over the right side and dims the map; clicking one of its tasks leaves the roadmap for /docs. Instead, open the epic as a pane docked on the **left**, and when a task in it is clicked, show that task's detail in the **rest of the screen** next to it — the same list · detail layout as Test review (`/manual-tests`), so you can walk an epic's tasks without losing the epic.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Epic sheet today: `RoadmapItemSheet` (`src/components/roadmap/RoadmapItemSheet.tsx:59`) wraps everything in a Radix `Sheet` / `SheetContent` (right side, `sm:w-[480px]`), mounted from `RoadmapTab.tsx:624` with `item={selected}` / `onSelect={setSelectedId}`.
- Task clicks: `LinkedTasks` and `Scenarios` call `onOpen={onEditRaw}` (`RoadmapItemSheet.tsx:189-190`), and `RoadmapTab` passes `onEditRaw={(file) => openDoc(file)}`, which navigates to /docs. That is what changes.
- Layout to copy: `src/app/(app)/manual-tests/page.tsx:394-404` — a `flex min-h-0 flex-1` row; list `section` is `lg:w-[min(44%,34rem)] border-r` when a detail is open, else `lg:flex-1`; on phones only one of list / detail shows; a `full` mode hides the list. Page height `h-[calc(100svh-3rem)]`.
- Task detail to reuse: `TaskDetailPanel` (`src/components/board/TaskDetailPanel.tsx:65`) is also a `Sheet`. Split its body (header, fields, runs, review, manual tests, content) from the `Sheet` wrapper so the same body renders inline here and still as a sheet on /board — don't duplicate it.
- URL state: deep links already exist (`/roadmap?item=R004`, `/board?task=T055`). Add `&task=T181` on /roadmap so the open task survives reload and Back.
- Keys: Esc closes the task first, then the epic; existing roadmap keys (`ITEM_KEYS`, `PAGE_HELP` in `src/lib/shortcuts.ts`) keep working; `shortcuts.check.mts` must pass if help text changes.
- UI text via `src/i18n/roadmap.ts` (en + vi). Motion: respect reduced motion like the map's 420ms tweens.

## Scope
- [ ] Epic pane docked left (same content as today's sheet: header, properties, progress, Tasks, Brief, Scenarios, actions bar), no dimming overlay; the map/timeline stays visible and interactive in the remaining space while no task is open
- [ ] Clicking a task in the pane (Tasks list or a Scenario's task chip) opens the task detail in the remaining width, map hidden behind it; the clicked row is marked selected in the pane
- [ ] Task detail = the extracted `TaskDetailPanel` body; "Open file" still goes to /docs
- [ ] Close task → back to epic pane + map; close epic → map only; Esc in that order; `?item=` / `&task=` in the URL
- [ ] Phones (< lg): pane full width; a task replaces it with a Back control, like /manual-tests
- [ ] /board's task sheet unchanged in look and behaviour

**Out of scope:** horizon items (keep current behaviour), editing layout of the epic content itself, the Timeline view's own selection model beyond opening the same pane

## Files
- `src/components/roadmap/RoadmapItemSheet.tsx` — drop the `Sheet` wrapper for an inline pane (or rename to `RoadmapItemPane`)
- `src/components/roadmap/RoadmapTab.tsx` — split layout, selected task state + URL
- `src/components/board/TaskDetailPanel.tsx` — extract `TaskDetailBody`; the board keeps the `Sheet`
- `src/i18n/roadmap.ts`, `src/lib/shortcuts.ts` if keys change
- `e2e/roadmap-epic-pane.mjs` — new; copy setup from an existing roadmap e2e (e.g. `e2e/scenarios.mjs`)

## Acceptance criteria
- [ ] Click an epic on the map → pane opens on the left, map still visible and not dimmed
- [ ] Click a task in the pane → its detail fills the rest of the screen; the task row is highlighted; URL has `?item=R066&task=T181`
- [ ] Reload with that URL → same state; Esc closes task, Esc again closes epic
- [ ] Changing the task's status in the detail updates the pane's task row and progress bar live
- [ ] 390px: pane full screen, task replaces it with Back
- [ ] Existing roadmap e2e (`e2e/scenarios.mjs`, `e2e/spec-changes.mjs`) and the board task panel still pass

## Verify
```bash
pnpm build
node src/lib/shortcuts.check.mts
PORT=3195 pnpm dev   # separate terminal
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3195 PW_DIR=$PW node e2e/roadmap-epic-pane.mjs
BASE=http://localhost:3195 PW_DIR=$PW node e2e/scenarios.mjs
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [ ] S5 — WHEN the user opens an epic on /roadmap and clicks one of its tasks → THEN the epic stays in a left pane and the task's detail fills the rest of the screen
- [ ] Open /roadmap, click an epic on the map → it docks on the left, the map stays visible and draggable beside it (not dimmed)
- [ ] Click 3 of its tasks one after another → each detail swaps in place, the clicked row is outlined, no page change or flicker
- [ ] Change a task's status from the detail → its dot and the epic's progress bar in the pane update
- [ ] Press Esc → the task closes; Esc again → the epic closes; reload with ?item=…&task=… → both reopen
- [ ] At phone width (390px) → the epic fills the screen; a task replaces it with "Back to R…"
### Regression risk
- [ ] /board: clicking a card still opens the task sheet on the right, with its quick actions and review buttons
- [ ] /roadmap: clicking a horizon still opens the sheet on the right
