# T146: Show automated vs manual items in the UI
**Status:** ✅ Done
**Phase:** R058 — Auto-tests from the checklist
**Size:** M
**Depends on:** T145
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
A human can see at a glance which checklist items are proven by a test and which still need a click-through, so only the manual ones get their attention.

## Context
- Epic: `plans/roadmap/R058-auto-tests-from-the-checklist.md` (Done when: "the task's checklist shows which items are automated vs still manual")
- Data from task 1: `manualTests: { total, done, auto, spec, autoRun }` and `auto` per item.
- Existing UI: the `🧪 done/total` badge on `TaskCard` (T060), the task panel's Manual tests section, and `/manual-tests` (`src/app/(app)/manual-tests/page.tsx`, T061).
- Tailwind only, no localStorage (CLAUDE.md).

## Scope
- [ ] Card badge: `🧪 3/5 · 🤖 2` when there are automated items. Red marker when `autoRun.result` is `failed`
- [ ] Task panel: a 🤖 icon next to automated items, and a header line "Spec: `<path>` · last run passed/failed <date>". The path is copyable (it lives in the target repo, so there's no doc link)
- [ ] `/manual-tests`: automated items are listed under a collapsed "Automated" group per task. The "untested" count counts only manual items that aren't ticked

**Out of scope:** a Run button and live progress (R061), screenshots (R059).

## Files
- `TaskCard`: the badge
- the task panel's Manual tests section component
- `src/app/(app)/manual-tests/page.tsx`

## Acceptance criteria
- [ ] A task with 2 🤖 + 3 manual items shows `🤖 2` on the card and icons in the panel; it updates live over SSE `task_updated`
- [ ] A task whose only unticked items are automated and passed doesn't show up as untested on /manual-tests
- [ ] A failed auto run shows a red marker on the card
- [ ] Tasks without 🤖 items render exactly as before

## Verify
```bash
npm run build && npm run lint
# Fixture: write a report with 🤖 items + spec via update_task → open /board, the task panel and /manual-tests
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] On a task with 🤖 items, open /board and look at the card → the badge shows the flask with done/total, then `·`, the robot icon and the automated count. The tooltip says how many are automated and the last run.
- [ ] Write `autoResult: "failed"` for that task over MCP while /board is open → the badge turns red with a small red dot, with no reload.
- [ ] Open that task panel → under the body: "0/5 manual tests ticked · 🤖 2 automated", then a line "Spec: `<path>`" with a copy icon and "last run failed <date>" in red. Click copy → the icon changes to a check and the path is on the clipboard.
- [ ] Open /manual-tests → that task lists Steps and Regression risk with manual items only, plus an "Automated (2)" row with the last run and the spec path. The row is open while the run is failed or has not run yet, and folded after a passed run.
- [ ] Write `autoResult: "passed"` and tick every manual item → the task leaves /manual-tests (unless Show fully tested is on), and the sidebar Manual tests count drops by that task items.
### Regression risk
- [ ] A task without 🤖 items still shows the same card badge (teal when all are ticked), the same panel row with no spec line, and the same /manual-tests card with numbered Steps.
- [ ] Ticking items on /manual-tests still saves to the task file, including a 🤖 item ticked by hand inside the Automated group.
