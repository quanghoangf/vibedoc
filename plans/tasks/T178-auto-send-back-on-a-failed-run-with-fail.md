# T178: Auto send-back on a failed Run with failing step, error and screenshot
**Status:** 📋 Ready
**Phase:** R065 — Self-fixing failures & flaky tests
**Size:** M (2–3 hrs)
**Depends on:** T176

## Goal
When a Run from VibeDoc fails, the task goes straight back to the agent: it's moved to todo with a `## Review` entry that lists each failed step with its error and screenshot. `vibedoc_next_task` then hands the agent everything it needs to fix it.

## Context
- Epic: `plans/roadmap/R065-self-fixing-failures-flaky-tests.md`
- Send-back already exists (T164): `sendBackTask(taskId, note, root, actor, { runId, marks })` with `ReviewMark = { item, step, kind: "failed" | "doubt", comment?, screenshot? }`, and `formatSendBackNote` writes the entry. `REVIEWABLE` in `src/lib/review.ts` allows send-back from `review` and `done`.
- T160 writes the run result in `src/app/api/tasks/run/route.ts` on the end event. This hooks in right after it.
- A **flaky** run is passed (previous task) and never triggers a send-back.
- CLAUDE.md: routes call `emitUpdate()`, core never does.

## Scope
- [ ] Pure `failedMarksForRun(items, run)` in `src/lib/evidence.ts`: one `kind: "failed"` mark per 🤖 item whose matched step failed, with the step name, the first error line as `comment`, and the step's screenshot file. Reuse `matchItems`. If a test failed with no matched item, add a mark with `item: -1` and the test title so nothing is lost (check that `review.ts` validation allows it, or extend it).
- [ ] Setting `tests.autoSendBack` (default `true`), read through core.
- [ ] Run route, on end `failed`, when the setting is on and the task is `done` or `review`: call `sendBackTask` with the run id, the marks and the note `Auto: run failed (<n> of <m> steps)`. The entry heading is marked as automatic (`— changes requested (auto)`), so the next task can count attempts. `latestReview` / `parseReviewMarks` read it back with `auto: true`. Old entries parse unchanged.
- [ ] A task that is `todo` / `in-progress` only gets the T160 header (an agent is already on it). Cancelled and error runs do nothing.
- [ ] Activity: one `task_updated` event, actor `human` (the person pressed Run), with the detail "auto send-back".
- [ ] Cases in `evidence.check.mts` (marks from a run with 1 failed step, a flaky run gives none) and `review.check.mts` (auto heading round trip).

**Out of scope:** the attempt cap (next task), suite runs (last task), and UI changes beyond what the existing changes-requested card already shows.

## Files
- `src/lib/evidence.ts` + check: `failedMarksForRun`
- `src/lib/review.ts` + check: the auto flag on the entry
- `src/lib/core.ts`: the `tests.autoSendBack` setting, plus an `auto` option on `sendBackTask`
- `src/app/api/tasks/run/route.ts`

## Acceptance criteria
- [ ] Break one step's expectation in a done task's spec, then click Run → the task is todo, the card shows **changes requested**, and the `## Review` entry has `Run <id>` and a `❌ Step N "…" — failed: <error> · screenshot <file>` line.
- [ ] `vibedoc_next_task` on that epic returns the task with those lines under `⚠️ Changes requested`, and `vibedoc_get_evidence { runId }` shows the screenshot.
- [ ] A flaky-only run and a passed run don't change the status. A cancelled run leaves the file byte-identical.
- [ ] `tests.autoSendBack: false` → only the `Auto: failed` header is written, as before.
- [ ] Checks pass. Lint stays at the baseline, and the build passes.

## Verify
```bash
node src/lib/evidence.check.mts && node src/lib/review.check.mts
pnpm lint && pnpm build
# break a step in a done task's spec, Run it on /manual-tests, then: git diff plans/tasks/<task>*.md
```
