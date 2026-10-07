# T509: Board task quick view: resizable, and more at a glance
**Status:** 👀 Review
**Phase:** R095 — UI enhancements
**Size:** L (half a day)
**Depends on:** T508
**Covers:** S6

## Goal
The task quick view on /board is a fixed 420px sheet, so long task bodies wrap into a narrow column and you can't widen it. Make its left edge draggable (and remembered), and redesign its top half with `/impeccable redesign` so the things you look for — what it depends on, test state, runs, verification, the chat about it — are visible without scrolling the body.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Panel: `TaskDetailPanel` (`src/components/board/TaskDetailPanel.tsx:65`), a Radix `Sheet` with `SheetContent side="right" … sm:max-w-[420px]` (line 103). Header + rows via `ItemPanelHeader` / `PropertyRows` (`src/components/shared/ItemPanelHeader.tsx`), fields from `src/components/board/TaskFields.tsx`, review block `ReviewActions` (line 408), runs `TaskRuns.tsx`.
- T508 extracts `TaskDetailBody` from this panel for the roadmap; build on that split (hence Depends on T508), the board keeps the `Sheet` wrapper.
- Resize pattern to copy: the docs explorer edge in `src/components/docs/DocList.tsx:42-60, 337-375` — `MIN/MAX/DEFAULT_WIDTH`, pointer drag on a `role="separator"` with `aria-valuenow`, ←/→ keyboard steps, no width transition while dragging.
- Persistence: no `localStorage` (CLAUDE.md). Use a per-browser cookie like `vibedoc-player` (`src/lib/player-prefs.ts`, pure, with a check) — e.g. `vibedoc-panel-width` — so the width survives reloads. Clamp to the viewport (`min(MAX, 100vw - 360px)`).
- Data already on `Task` that the panel doesn't surface well today: `dependsOn`, `covers`, `started` / `finished`, `manualTests {done,total,auto,untested,autoRun}`, `lastRun`, `verification` findings, `updatedAt`; chat status via `itemAgents` / `AgentMark` (ChatContext).
- T507 adds `testReviewHref()`; use it for any test link here.
- Run `/impeccable redesign` on the panel before writing markup; record its decisions in the task report. DESIGN.md tokens only; UI text in `src/i18n/board.ts` (en + vi).

## Already shipped (2026-10-07, before this task ran)
- The sheet's left edge resizes it (drag, ←/→, double-click resets), width in the `vibedoc-panel-width` cookie (`src/lib/panel-width.ts` + check); `e2e/board-task-panel.mjs`
- Header button + ⇧O "Open full document" (`openDoc(task.file)`); the panel's Edit form and ⇧E were removed (title/meta are edited inline or in the full doc)
- What remains here: the `/impeccable redesign` of the top half (dependencies, tests, runs, chat at a glance)

## Scope
- [ ] Draggable left edge on the sheet (pointer + keyboard, `role="separator"`), width from ~380px to ~70% of the viewport, remembered in a cookie (pure helper + `.check.mts`)
- [ ] Wider panel uses the space: body text gets a readable max line length; at wide widths the property rows can sit in two columns if the redesign calls for it
- [ ] `/impeccable redesign` of the top half: surface Depends on (status of each dependency, clickable), Covers (scenario ids), test state (`done/total`, auto result → Test review), last run / verification findings count, the agent chat about this task, Started / Done dates; keep Status / Priority / Owner / Due / Size / Epic editable as today
- [ ] Review / Verify / Chat actions stay where users find them now, or move only if the redesign gives a clear reason (note it)
- [ ] Phones: full width, no drag handle

**Out of scope:** the roadmap's inline task detail (T508), the task body's markdown rendering, new task fields

## Files
- `src/components/board/TaskDetailPanel.tsx` (+ the extracted body from T508)
- `src/lib/panel-width.ts`, `src/lib/panel-width.check.mts` — new (cookie read/write, clamp)
- `src/i18n/board.ts`
- `e2e/board-task-panel.mjs` — new; copy setup from `e2e/manual-tests-review.mjs` or another board e2e

## Acceptance criteria
- [ ] Drag the panel's left edge → it widens/narrows smoothly; ←/→ on the focused edge do the same; reload → same width
- [ ] Width never covers the whole board on a laptop screen (clamped) and has no handle on phones
- [ ] Without scrolling, the panel shows Depends on (with their statuses), test state, last run / findings and the chat state for a task that has them; each is clickable to its place
- [ ] Editing Status / Due etc. still works as before; Approve / Send back / Verify / Chat still work
- [ ] Light + dark, Vietnamese labels correct; `pnpm build` passes, no new lint errors

## Verify
```bash
node src/lib/panel-width.check.mts
pnpm build
PORT=3195 pnpm dev   # separate terminal
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3195 PW_DIR=$PW node e2e/board-task-panel.mjs
BASE=http://localhost:3195 PW_DIR=$PW node e2e/manual-tests-review.mjs
```

## Redesign decisions (/impeccable)
Mode: Operate, inside the existing "Lab Notebook" world (DESIGN.md tokens only; refinement of structure, not a new look).
- **One vocabulary:** everything at a glance is another row in the shared `PropertyRows` grid (icon + label → value), not a new card strip. Editable fields first (Status · Priority · Owner · Due · Size · Epic, unchanged), then what the task waits on and what proves it: Depends on · Covers · Tests · Last run · Verification · Chat · Worked (Started → Done). Rows without data drop out.
- **Each value links to its place:** dependency chips (`StatusIcon` + mono id, dashed when the task doesn't exist) → `/board?task=`; Tests (`1/2 ticked · 🤖 n · passed MM-DD`) → `testReviewHref(id)`; Last run (`passed 4/4` / `failed at step N · name`) → the evidence view; Verification (critical + major count, red with a critical, amber otherwise; "nothing found" teal; "outdated" amber) scrolls to the report below; Chat (`StatusMarker` + state, idle shown) opens it.
- **Wide panel uses the space:** the header is a container; from 42rem (`@2xl`) the rows sit in two columns, so a 13-row header stays ~7 rows tall. The same applies to /roadmap's inline task detail (T508), which got wider for free. Body capped at 72ch.
- **No duplicates:** the "N/M manual tests ticked" row under the body moved up into Tests; the line below keeps only the spec path to copy.
- **Actions unchanged:** move buttons, Verify, Chat and Approve / Send back stay where they were (no reason found to move them).
- Mono 10–11px for ids, counts and dates; status hues only for state (teal settled, amber watch, red stopped). No new type sizes, colours or shadows.

## Manual tests
_Auto: `e2e/board-task-panel.mjs` passed 2026-10-07, twice in a row (items below marked [x] are what it proved). `pnpm typecheck` + `pnpm build` ok, lint 10 errors (baseline, none in the touched files), `panel-width` / `i18n` checks ok; `quick-review`, `verification`, `roadmap-epic-pane`, `i18n` e2e pass, `manual-tests-review` passed on its rerun (known flaky)._
### Steps
- [x] S6 — WHEN the user drags the task quick view's edge on /board → THEN it resizes, keeps the width after a reload, and shows dependencies, tests, runs and chat state at a glance
- [x] Open a task with dependencies, tests, findings and a chat (e.g. a Review task) → the header shows Depends on (each with its status icon), Covers, Tests `done/total ticked`, Verification `N findings`, Chat state and Worked dates without scrolling
- [x] Click a dependency chip → that task's panel opens on the board; the Tests row links to Test review for this task
- [x] Widen the panel past ~670px → the rows sit in two columns; narrow it → one column
- [ ] Click the Verification row → the panel scrolls to the findings block
- [ ] The header reads clearly at narrow and wide widths, light and dark, English and Vietnamese (visual)
- [ ] /roadmap → open an epic → click a task: the inline detail shows the same rows (two columns at that width)
### Regression risk
- [ ] Approve / Send back from the panel still moves the card; editing Status / Due inline still saves
