# T063: /work-epic writes a manual test report; queue handles review
**Status:** ✅ Done
**Phase:** R043 — Task verification & review
**Size:** M
**Depends on:** T060, T062

## Goal
An agent running `/work-epic` marks each task done **with a manual test report** that it wrote from what it actually changed. The work queue understands the optional Review status. And when a task comes back with changes requested, the agent sees the reviewer's note first and fixes it.

## Context
- Epic: `plans/roadmap/R043-task-verification-and-review.md`
- Queue logic: `src/lib/work-queue.ts` (`pickNextTask`, `QueueResult`), T031's waiting reasons, and `skills/work-epic/SKILL.md` (T033).
- Report format: the `## Manual tests` shape from T060 (Steps with expected results, plus Regression risk).
- Decided: the default is still **done**, not review, so the loop never waits on a human. The agent moves a task to review only when it can't judge the result itself (e.g. a visual change, or Verify couldn't run fully).
- A task in `review` is not done: its dependents wait until a human approves it.

## Scope
- [ ] `skills/work-epic/SKILL.md`: after Verify passes, write the report and call `vibedoc_update_task { status: "done", manualTests }`. Guidance for the report:
  - 3–8 items, written for a non-technical tester: where to go, what to click, what they should see
  - At least 1 regression-risk item, for the existing feature the change most likely affects
  - No items that only repeat the automated Verify commands
- [ ] Skill: when to use `review` instead of done (see Context). When a claimed task shows changes requested, address the note first
- [ ] `pickNextTask`: `review` doesn't count as a met dependency and blocks `finished`. The waiting reason reads "T0xx in review — needs a human"
- [ ] Sent-back tasks (todo, where the latest review is `changes requested`) are handed out like any todo task. The `🔨 Claimed` response puts the note first, under a `⚠️ Changes requested:` line
- [ ] Extend `work-queue.check.mts` with the review cases

**Out of scope:** auto-approval, running tests inside VibeDoc, and forcing a report.

## Files
- `skills/work-epic/SKILL.md`
- `src/lib/work-queue.ts` + `.check.mts`
- `src/lib/core.ts` `claimNextTask()` / the `vibedoc_next_task` case in `src/app/api/mcp/route.ts`

## Acceptance criteria
- [ ] Running `/work-epic R002` against the fixture ends with both tasks done, each with a `## Manual tests` section and a `🧪` badge on its card
- [ ] Epic `[T001, T002]`, T002 depends on T001: with T001 in review, `next_task` returns waiting "T001 in review — needs a human"
- [ ] With every task in review or done, the epic is not reported finished
- [ ] A sent-back task is claimed again and the response shows the note first

## Verify
```bash
node src/lib/work-queue.check.mts
pnpm build && pnpm lint
# Fixture: /work-epic R002 → T001, T002 done with manual test reports; /manual-tests lists both
# Move T001 to review, send it back with a note → /work-epic R002 reclaims T001 and shows the note
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Run /work-epic on a small epic → each finished task ends with a ## Manual tests section and a 🧪 badge on its card
- [ ] Move a task to Review → /work-epic on its epic stops with "T0xx in review — needs a human" instead of skipping ahead to tasks that depend on it
- [ ] Send that task back with a note, run /work-epic again → the agent claims it and the reply shows ⚠️ Changes requested with your note before the spec
- [ ] Open /manual-tests → the reports the agent wrote are listed there
### Regression risk
- [ ] /work-epic on an epic with no review tasks runs to "Epic … is finished" as before
- [ ] A blocked task still stops the run with Needs a human
