# T507: Jump from a task doc to its manual tests
**Status:** 📋 Todo
**Phase:** R095 — UI enhancements
**Size:** M (2–3 hrs)
**Depends on:** T505
**Covers:** S4

## Goal
A task file opened in /docs has a `## Manual tests` checklist, but nothing on the page leads to Test review (`/manual-tests`), where the items are ticked, runs replayed and evidence read. Make getting there one obvious click from anywhere on the doc, and show the test state at a glance. Redesign the touch points with `/impeccable redesign`.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Data is already on the task: `Task.manualTests = { total, done, auto, untested, spec, autoRun }` (`src/lib/core.ts:86`), from `parseManualTests` in `src/lib/manual-tests.ts`. Look the task up from AppContext `board` by id (same as T505).
- Test review deep links today: `/manual-tests?tab=all&task=<id>&view=evidence` built by hand in 5 places — `TaskCard.tsx:135,161`, `TaskDetailPanel.tsx:182`, `TaskRuns.tsx:77`, `RoadmapItemSheet.tsx:489`, `SuiteTab.tsx:19`. Without `&view=evidence` it opens the checklist/run replay.
- T505 turns the meta block into property rows in `DocProperties`; the test row belongs there.
- `## Manual tests` heading in the body: `MANUAL_TESTS_HEADING` (`manual-tests.ts:12`); the doc outline (`DocOutline.tsx`) lists headings.
- Design language: DESIGN.md; the board card's `🧪 done/total` badge and `ReviewMark` are the existing vocabulary for test state. UI text in `src/i18n/docs.ts` (en + vi).
- Run `/impeccable redesign` on these touch points before writing markup; record its decisions in the task report.

## Scope
- [ ] One helper `testReviewHref(taskId, view?: 'evidence')` (e.g. `src/lib/test-review.ts`, pure) and switch the 5 hand-built links to it
- [ ] Property row "Manual tests" on task docs (with T505's rows): `done/total`, auto result (passed / failed / unverified / flaky) using the existing marks, click → Test review for this task; secondary action → Evidence
- [ ] At the `## Manual tests` heading in the rendered body: an inline "Open in Test review" action next to the heading, so readers who scroll there can jump too
- [ ] Doc header (next to the links button): a compact test-state chip on task docs that opens Test review; keyboard shortcut if `/impeccable redesign` and `PAGE_HELP` in `src/lib/shortcuts.ts` support it (then add it to the help list; `shortcuts.check.mts` must pass)
- [ ] Task docs with no `## Manual tests` show "No manual tests yet" in the row, no dead links; non-task docs show nothing
- [ ] Apply the `/impeccable redesign` direction to these three touch points so they read as one system with the board card badge

**Out of scope:** changes to the /manual-tests page itself, editing checklist items from /docs

## Files
- `src/lib/test-review.ts` (+ `.check.mts` if it has logic beyond string building)
- `src/components/docs/DocProperties.tsx`, `src/components/docs/DocViewer.tsx`, `src/components/docs/MarkdownRenderer.tsx` (heading action)
- `TaskCard.tsx`, `TaskDetailPanel.tsx`, `TaskRuns.tsx`, `RoadmapItemSheet.tsx`, `SuiteTab.tsx` — use the helper
- `src/i18n/docs.ts`, `src/lib/shortcuts.ts` if a key is added
- `e2e/doc-manual-tests.mjs` — new; copy setup from `e2e/docs-lint.mjs` (fixture task with a `## Manual tests` section)

## Acceptance criteria
- [ ] Open a task with manual tests in /docs → the Manual tests row shows `done/total` and the auto result; clicking it lands on `/manual-tests` with that task selected
- [ ] The heading action and the header chip go to the same place; Evidence goes to `view=evidence`
- [ ] A task without manual tests shows the empty text; a normal doc shows none of it
- [ ] The 5 old links still open the same URLs (now via the helper)
- [ ] Light + dark, 390px width, Vietnamese labels correct
- [ ] `pnpm build` passes; no new lint errors

## Verify
```bash
pnpm build
node src/lib/shortcuts.check.mts
PORT=3195 pnpm dev   # separate terminal
BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright node e2e/doc-manual-tests.mjs
```

## Manual tests
### Steps
- [ ] S4 — WHEN a task doc with manual tests is open in /docs → THEN one click (property row, heading action or header chip) opens that task in Test review
- [ ] The three touch points look like one system with the board's 🧪 badge (visual check after /impeccable redesign)
