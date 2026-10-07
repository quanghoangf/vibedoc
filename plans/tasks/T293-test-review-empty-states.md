# T293: Test review, suite and evidence empty states
**Status:** 📋 Todo
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
- [ ] Extend `e2e/empty-states.mjs` with /manual-tests, /manual-tests?tab=suite and an evidence view of a task with no runs (fixture: one task with a `## Manual tests` checklist).

**Out of scope:** running tests in the empty state beyond the existing Run action.

## Files
- `src/app/(app)/manual-tests/page.tsx`, `src/components/manual-tests/{SuiteTab,RunPlayer,TestEvidence}.tsx`
- `src/i18n/tests.ts`
- `e2e/empty-states.mjs`

## Acceptance criteria
- [ ] Empty project: /manual-tests and the suite tab show a lead and one action
- [ ] Evidence for a task with no run: lead + one action (Run or the command)
- [ ] vi passes the i18n checks

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3083 PW_DIR=. node e2e/empty-states.mjs
BASE=http://localhost:3083 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
### Steps
- [ ] S1 — WHEN the user opens test review, the suite tab and evidence with nothing recorded → THEN each says what fills it and offers one action
- [ ] S2 — WHEN no agent is connected → THEN the `/vibedoc:work` action has the Connect link
- [ ] S4 — WHEN the language is Tiếng Việt → THEN these empty states are Vietnamese
