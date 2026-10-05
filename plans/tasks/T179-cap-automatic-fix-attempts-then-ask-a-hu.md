# T179: Cap automatic fix attempts, then ask a human
**Status:** ✅ Done
**Phase:** R065 — Self-fixing failures & flaky tests
**Size:** S (~1 hr)
**Depends on:** T178
**Owner:** ai:claude-code
**Due:** 2026-10-06
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
The agent doesn't loop forever on a test it can't fix. After N automatic send-backs in a row, the next failure moves the task to **review**, shows "needs a human", and stops handing it to agents.

## Context
- Epic: `plans/roadmap/R065-self-fixing-failures-flaky-tests.md` (in scope: "a cap on automatic fix attempts before a human is asked").
- The previous task writes `— changes requested (auto)` entries, read back by `latestReview` with `auto: true`.
- `/work-epic` already retries a failing spec at most 2 times inside one session (T148). This cap counts **across** sessions/runs.
- A review task is not ready for `vibedoc_next_task` (it says `T0xx in review — needs a human`). That's the stop.

## Scope
- [ ] Setting `tests.maxAutoFixes` (default 3).
- [ ] Pure `autoFixStreak(raw)` in `src/lib/review.ts`: the number of consecutive auto send-back entries since the last approve, human send-back, or a passed run. A passed run resets it: compare against the `Auto: passed` header date, or append a short `— auto run passed` entry. Pick one and note it in the code.
- [ ] Run route: when the streak is already `>= maxAutoFixes`, set the task to `review` with an entry `— auto fix limit reached (N attempts)`, listing the same failed marks, instead of sending it back.
- [ ] `vibedoc_next_task` claim reply for an auto-sent-back task: add `Auto-fix attempt k of N` under the changes-requested note.
- [ ] Board card / task panel: a review task whose latest entry is the limit entry shows the label **Needs a human** (reuse the review chip styling).
- [ ] `skills/work-epic/SKILL.md`: one paragraph on auto send-backs and the cap, and never weaken assertions to escape it.
- [ ] `review.check.mts`: streak counting with mixed entries and a reset by a pass; `work-queue.check.mts`: the attempt line.

**Out of scope:** per-task cap overrides, and notifications.

## Files
- `src/lib/review.ts` + check, `src/lib/core.ts` (setting, claim reply), `src/lib/work-queue.check.mts`
- `src/app/api/tasks/run/route.ts`
- the board card / task panel review chip
- `skills/work-epic/SKILL.md`

## Acceptance criteria
- [ ] With `maxAutoFixes: 2`: fail → todo (1), fail → todo (2), fail → review with the limit entry and a Needs a human label. `vibedoc_next_task` no longer hands it out.
- [ ] A passed run in between resets the streak.
- [ ] Checks pass. Lint stays at the baseline, and the build passes.

## Verify
```bash
node src/lib/review.check.mts && node src/lib/work-queue.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] With `"tests": { "maxAutoFixes": 2 }` and a done task whose spec fails: Run → todo (auto send-back 1); claim it with vibedoc_next_task → "Auto-fix attempt 1 of 2"; mark it done and Run → todo again, claim shows "Auto-fix attempt 2 of 2 (the next failed run goes to a human)"; mark done and Run → the task goes to review with `— auto fix limit reached (2 attempts)` listing the failed step (agent checked this full loop on T153, since restored)
- [ ] vibedoc_next_task on that epic then says "T0xx in review — needs a human"
- [ ] On /board the card shows a red "needs a human" chip; its panel says "Needs a human. The agent couldn't make the test pass after 2 automatic fixes…" and the Review history reads "Needs a human · 2 auto fixes failed" / "Changes requested (auto)"
- [ ] After one auto send-back, a passing Run writes `— auto run passed` and the streak starts over
- [ ] skills/work-epic/SKILL.md has the "Automatic send-backs" paragraph
### Regression risk
- [ ] Approve / Send back by hand still work on a task in review (including one at the limit) and write the usual entries
