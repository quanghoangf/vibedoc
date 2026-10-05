# T175: e2e: breaking an old feature names its task in the suite, + docs
**Status:** 📋 Ready
**Phase:** R064 — Regression suite
**Size:** M
**Depends on:** T174

## Goal
Prove the epic's Done when automatically: deliberately breaking a feature from an earlier done task makes the suite run name that task with a failing screenshot. Document the suite for users and agents.

## Context
- Epic: `plans/roadmap/R064-regression-suite.md`. Done when: *breaking a feature from an earlier done task makes the suite run name that task with a failing screenshot*.
- Earlier e2e checks for runs live in `e2e/` (see T162 for Run from VibeDoc and T156 for evidence) and use the fixture kit from T158. Follow their setup: a throwaway project dir or env-controlled break, never a change to real app code.
- `e2e/fixtures/capture-demo.spec.ts` already supports a forced failure (`CAPTURE_DEMO_FAIL=1`). Reuse that style for the break switch.

## Scope
- [ ] An e2e spec that sets up a small project with two done tasks, each with a spec (a tiny fixture app or the demo spec pair), runs the suite through the UI (`/manual-tests?tab=suite` → Run suite) and asserts both pass.
- [ ] With the break switch on for one task, a second run shows that task first as broken, with its failing step name and a visible screenshot `img`. The other task still passes. Open evidence lands on the same failure.
- [ ] The spec cleans up its temp project and runs dirs.
- [ ] Docs:
  - The user docs page on running tests from VibeDoc gets a "Regression suite" section: what's included (done tasks with a spec), one process, the shared one-run lock, and where results are written.
  - `docs/` API reference: the `/api/suite/run` routes and the `suite_run` SSE event.
  - `/work-epic` skill guidance: specs must be self-contained so they can run together in one process (no reliance on test order or leftover state).
- [ ] Mark the R064 Done when as met in the final manual test report.

**Out of scope:** CI wiring, cross-browser runs (epic out of scope), and flaky retries (R065).

## Files
- `e2e/vibedoc/T175-regression-suite.spec.ts` (number per the created task id): new
- The docs page covering Run from VibeDoc (find it with the T162 docs change) and the API reference doc
- `~/.claude/skills/work-epic/SKILL.md`: one rule about self-contained specs

## Implementation notes
- Keep the e2e independent of how many real done tasks VibeDoc itself has: point it at the temp project, not this repo.
- Wait on the suite's final state through the UI text ("Failed · 1 of 2 tasks broke"), not on timeouts.

## Acceptance criteria
- [ ] The e2e passes locally twice in a row.
- [ ] Flipping the break switch makes the suite name the broken task with a screenshot, which is the epic's Done when.
- [ ] The docs describe the Suite tab, the API and the SSE event. The work-epic rule is added.
- [ ] Lint stays at the baseline and the build passes.

## Verify
```bash
pnpm lint && pnpm build
npx playwright test e2e/vibedoc/*regression-suite*.spec.ts
```
