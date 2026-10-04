# T155: Evidence tab in Test review, with run history
**Status:** 📋 Todo
**Phase:** R060 — Evidence report per task
**Size:** M (2–3 hrs)
**Depends on:** T154

## Goal
On `/manual-tests`, a task's detail has an **Evidence** view: the evidence doc with a screenshot and result for every checklist item, and a history of runs you can switch between.

## Context
- Epic: `plans/roadmap/R060-evidence-report-per-task.md`
- Interview decision: the view is a tab inside the Test review detail (`src/components/manual-tests/TestDetail.tsx`), not a new route. It reuses Open as page / Collapse / Close.
- URL state follows the page's existing pattern (`?task= &tab= &epic= &q= &full= &panel=` through `setParams`): add `&view=evidence` and `&run=<runId>`. No param = the current Review view (RunPlayer plus checklist).
- Data: `GET /api/tasks/[id]/evidence?run=` (T154) returns the markdown with ready-to-use image URLs.
- Visual language: DESIGN.md "Manual Test Report (signature)". No localStorage, Tailwind only, and no new react-hooks lint errors (baseline 17 problems): no setState in effects, no use before declare.

## Scope
- [ ] Segmented control in the detail header: `Review` · `Evidence`. Key `v` toggles it; add it to `TEST_REVIEW_KEYS` in `src/lib/shortcuts.ts` and keep `shortcuts.check.mts` passing (no collision with page-jump keys).
- [ ] Evidence view: render `markdown` with the existing `MarkdownRenderer`. Images load from the runs API, and a screenshot click opens it large (reuse the dialog pattern from `src/components/board/TaskRuns.tsx`).
- [ ] History: render the `runs` list as a compact selectable list above the doc (newest first, result dot, relative time, short commit). Picking one sets `&run=`. Keys j/k must keep walking the task list, not the runs.
- [ ] Refetch when the task's `lastRun.runId` changes (SSE refresh), like `RunPlayer` does with `latest`.
- [ ] Loading skeleton. No runs → the doc's own "no run yet" line plus the spec path when there is one.

**Out of scope:** Run buttons (R061), approve/send back from evidence (R062), entry points from the board (T156), and printing/export.

## Files
- `src/components/manual-tests/TestDetail.tsx`: tab control; `view` prop.
- `src/components/manual-tests/TestEvidence.tsx`: new; fetch, history, doc.
- `src/app/(app)/manual-tests/page.tsx`: read and write `view` / `run` params, and the `v` key in the page key handler.
- `src/components/docs/MarkdownRenderer.tsx`: only if images need a hook, e.g. `max-w-full`, rounded border, lazy loading, and a click handler. Don't change rendering for other docs.
- `src/lib/shortcuts.ts`, `DESIGN.md` (signature section: the Evidence view).

## Implementation notes
- Check how `MarkdownRenderer` renders `img` today (it may only run through react-markdown defaults). The runs API needs a same-origin URL, which T154 already builds.
- Switching task resets `run` (use `setParams({ task, run: null })` in `select`).

## Acceptance criteria
- [ ] `/manual-tests?task=T138&view=evidence` shows the doc. Every 🤖 item has its screenshot and ✅/❌, and the video link plays.
- [ ] Picking an older run in History changes the doc and the URL. Reload keeps it.
- [ ] `v` switches Review ↔ Evidence. Esc still closes the panel. j/k still walk the task list.
- [ ] Phone width: no horizontal scroll, and images fit the column.
- [ ] Lint stays at the baseline (17), and the `shortcuts.check` passes.

## Verify
```bash
node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
# open http://localhost:3000/manual-tests?task=T138&view=evidence (desktop + 390px)
```
