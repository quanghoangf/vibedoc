# T148: Run the spec before done; fail → fix or review
**Status:** ✅ Done
**Phase:** R058 — Auto-tests from the checklist
**Size:** M
**Depends on:** T147
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
"Done" means proven: `/work-epic` runs the task's spec and only moves the task to done when it passes, recording the result on the task.

## Context
- Epic: `plans/roadmap/R058-auto-tests-from-the-checklist.md` (Done when: "an agent finishing a UI task leaves a spec next to the code, the run passes, …")
- The agent runs the spec itself from its shell. VibeDoc doesn't run tests in this epic (that's R061).
- Start and URL: use R057's detected start command and URL, or the repo's `webServer` config if there is one. Don't start a second dev server when one is already listening.
- Builds on T063's rule: the default is done, and review only when the agent can't judge the result itself.

## Scope
- [ ] Skill: after writing the spec, run `npx playwright test <spec>` (from the FE app's directory)
- [ ] Pass → `vibedoc_update_task { status: "done", manualTests, spec, autoResult: "passed" }`, with the 🤖 items ticked, because they're proven
- [ ] Fail → the agent first decides whether the code or the test is wrong, fixes it and re-runs (max 2 retries). If it still fails → `status: "review"`, `autoResult: "failed"`, and the failing step plus the error message in the report
- [ ] Never weaken an assertion just to get a pass. Say this explicitly in the skill
- [ ] The `vibedoc_next_task` claim response for a sent-back task with a failed auto run mentions the spec path

**Out of scope:** flaky-test handling (R065), regression runs across tasks (R064), capture (R059).

## Files
- `skills/work-epic/SKILL.md`
- `src/lib/core.ts` `claimNextTask()` / the `vibedoc_next_task` response: the spec line
- `src/lib/work-queue.check.mts`: the claim-response case

## Acceptance criteria
- [ ] Fixture run: a UI task ends done with `Auto: passed <date>` in the header and its 🤖 items ticked
- [ ] With a deliberately broken assertion that can't be fixed, the task ends in review with `Auto: failed` and the failing step in the report
- [ ] The card shows the result (task 2)
- [ ] `work-queue.check.mts` passes with the new case

## Verify
```bash
node src/lib/work-queue.check.mts
node src/lib/manual-tests.check.mts
npm run build && npm run lint
# Fixture FE app: /work-epic on an epic with one UI task → done, spec passes: npx playwright test e2e/vibedoc/
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [x] Make a fixture task with a `## Manual tests` header ending in `· Auto: failed <date>` and a spec path, send it back from review on /board, then call `vibedoc_next_task` for its epic → after the "⚠️ Changes requested" note, the reply has a "🤖 Last auto run failed (<date>): spec `<path>`" line
- [x] Same task with `Auto: passed` instead → the claim reply has no "🤖 Last auto run failed" line
- [x] Open skills/work-epic/SKILL.md → step 5 says a UI task with a spec is done only when it passes, and a "Run the spec" section covers: reuse the running server or webServer, `npx playwright test` from the app Dir, tick 🤖 on pass, at most 2 retries, then review with autoResult failed and a "### Failing auto run" group
- [x] In the skill, the "Never weaken an assertion just to get a pass" paragraph lists the banned tricks (loosen or delete expect, test.skip/.fixme, drop the 🤖 mark)
- [x] On /board, open a task saved with `autoResult: "failed"` → the card's 🧪 badge shows the failed state (red border and dot), and a passed task shows its 🤖 items counted as proven
### Regression risk
- [x] Claim a normal task with no manual tests, or one only sent back from review → the claim reply looks as it did before (no extra line, the Changes requested note is still first)
