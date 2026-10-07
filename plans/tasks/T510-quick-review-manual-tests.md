# T510: Quick review of a task's manual tests from the board
**Status:** 👀 Review
**Phase:** R095 — UI enhancements
**Size:** M (2–3 hrs)
**Covers:** S7

## Goal
On /board (Table, Board and By epic views) a task in **Review** shows only a `🧪 3/6` count; to actually review it you go to /manual-tests, find the task, tick, then approve. Give every task in review a one-click **Review** button that opens a quick review right there: the checklist to tick, the auto-run result, and Approve / Send back — and a link to the full Test review when more is needed.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Table: `src/components/board/views/TableView.tsx` — status cell `TaskStatusField` (line 119), test cell `FlaskConical done/total` (lines 155-158). Card: `src/components/board/TaskCard.tsx` (🧪 badge line 177, already links to evidence).
- Test data: `Task.manualTests {total, done, auto, untested, spec, autoRun}`; items via `parseManualTests(raw)` in `src/lib/manual-tests.ts` (`Task.raw` is on the board's task). Tick = `POST /api/tasks/manual-tests` (same as /manual-tests).
- Review actions: `ReviewActions` (`src/components/board/TaskDetailPanel.tsx:408`) already does Approve / Send back with note → `POST /api/tasks/review`. Reuse it.
- Full review page: `TestDetail` (`src/components/manual-tests/TestDetail.tsx:32`), `Tick` (line 345). Reuse `Tick` and the item rendering; don't copy the page.
- T507 adds `testReviewHref()`; use it for "Open in Test review" / "Evidence".
- Optimistic updates with rollback (CLAUDE.md global rule + existing `updateTaskFields` pattern); UI text in `src/i18n/board.ts` (en + vi).

## Scope
- [ ] A **Review** button on rows/cards whose status is review (Table: in or next to the 🧪 cell; Board / By epic: on the card), keyboard reachable; hidden for other statuses
- [ ] It opens a quick-review popover (or small dialog on phones) anchored to the row: task id + title, auto-run line (passed / failed / unverified / flaky, last date), the checklist with `Tick` boxes (🤖 items shown as such), and `ReviewActions` (Approve / Send back)
- [ ] Ticking updates the count in the row immediately; Approve moves the row/card to Done and closes the popover; Send back asks for the note as today
- [ ] Footer links: Open in Test review, Evidence (via `testReviewHref`)
- [ ] Keyboard: open with the button or a key on the focused row (add to `PAGE_HELP` if a key is added), Esc closes, focus returns to the row

**Out of scope:** running specs from the popover, editing checklist text, non-review tasks

## Files
- `src/components/board/QuickReview.tsx` — new (popover body)
- `src/components/board/views/TableView.tsx`, `src/components/board/TaskCard.tsx`
- `src/components/manual-tests/TestDetail.tsx` — export the checklist item renderer if needed
- `src/i18n/board.ts`, `src/lib/shortcuts.ts` if a key is added
- `e2e/quick-review.mjs` — new; copy setup from `e2e/manual-tests-review.mjs`

## Acceptance criteria
- [ ] In Table view, a review row shows a Review button; clicking it shows the task's checklist and auto-run result without leaving /board
- [ ] Tick an item → the row's `🧪 n/m` updates; reload → still ticked
- [ ] Approve → the task becomes Done in the table and on the board; Send back with a note → Todo with the note recorded in `## Review`
- [ ] Same button on review cards in Board and By epic views
- [ ] Rows not in review show no button; Esc closes and focus returns to the row
- [ ] `pnpm build` passes; `e2e/quick-review.mjs` and `e2e/manual-tests-review.mjs` pass

## Verify
```bash
pnpm build
PORT=3195 pnpm dev   # separate terminal
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3195 PW_DIR=$PW node e2e/quick-review.mjs
BASE=http://localhost:3195 PW_DIR=$PW node e2e/manual-tests-review.mjs
```

## Manual tests
_2026-10-07 — ai:claude-code_
### Steps
- [ ] S7 — WHEN a task is in Review on /board and the user clicks its Review button → THEN its manual tests open in a quick review where items can be ticked and the task approved or sent back
- [ ] Open /board?view=table with a task in review → its 🧪 cell shows a Review button; other rows show none
- [ ] Click Review → a popover under the button shows the id + title, an "Auto run passed/failed · date" line, the checklist (🤖 items with a robot icon) and Approve / Send back… → tick a box → the row's 🧪 count goes up at once
- [ ] Press Esc → the popover closes and focus is back on the Review button (Tab from the title also reaches it)
- [ ] On a phone-width window (≤ 640px) open a review card on /board → the quick review shows as a centred dialog over a dimmed page, scrollable when long
- [ ] Footer links "Open in Test review" and "Evidence" → open /manual-tests on that task (checklist / Evidence view)
### Regression risk
- [ ] /manual-tests still ticks and approves the same task correctly
- [ ] Clicking a board card (not its Review button) still opens the task panel, and dragging a review card between columns still works
