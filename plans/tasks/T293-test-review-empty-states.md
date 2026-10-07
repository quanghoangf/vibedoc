# T293: Test review, suite and evidence empty states
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Phase:** R083 — Teaching empty states
**Size:** M (2–3 hrs)
**Depends on:** T290
**Covers:** S1, S2, S4

## Goal
Test review in an empty project explains where reviews, runs and evidence come from and what to do to get the first one.

## Context
- Epic: `plans/roadmap/R083-teaching-empty-states.md`
- Reuse T290's `EmptyState`, `CopyCommand`, `useAgentConnected`.
- List (`manual-tests/page.tsx:594` `Empty`): "Nothing to review yet" + a lead about `manualTests`, no action.
- Suite (`SuiteTab.tsx:56`): "No suite run yet…", Run suite disabled with no specs.
- Evidence / run player (`RunPlayer.tsx:198`, `TestEvidence.tsx:168`): "No recorded run yet".

## Scope
- [ ] List: lead = when the agent finishes a task it leaves a checklist and a recorded run here for you to approve; action = copy `/vibedoc:work` (needsAgent). With tasks but nothing to review, keep today's copy.
- [ ] Suite: lead = replays every done task's spec to catch regressions; action = "Run suite" when specs exist, else a link to the list tab / `/vibedoc:work` command (the thing that produces specs).
- [ ] Evidence / run player with no run: lead on what a run records (steps, screenshots, video); action = the existing Run button (`useTestRun`) when the task has a spec, else copy `/vibedoc:work`.
- [ ] i18n `tests.ts`, `en` + `vi`.
- [ ] Extend `e2e/empty-states.mjs` with /manual-tests, /manual-tests?tab=suite and an evidence view of a task with no runs (fixture: one task with a `## Manual tests
_2026-10-07 — ai · Spec: `e2e/vibedoc/T293-test-review-empty-states.spec.ts` · Auto: passed 2026-10-07_
### Steps
- [x] 🤖 S1 — WHEN the user opens test review, the suite tab and evidence with nothing recorded → THEN each says what fills it and offers one action
- [x] 🤖 A task with a spec but no run → the run player offers Run the spec
- [x] 🤖 S2 — WHEN no agent is connected → THEN the /vibedoc:work action has the Connect link
- [x] 🤖 S4 — WHEN the language is Tiếng Việt → THEN these empty states are Vietnamese
- [ ] On a task with a real spec and no run, click Run the spec → the run starts (the live strip shows) and a recorded run replaces the empty state when it ends
### Regression risk
- [ ] A task with recorded runs still shows the player with its video, and the suite tab with specs still shows Run suite and its last result
