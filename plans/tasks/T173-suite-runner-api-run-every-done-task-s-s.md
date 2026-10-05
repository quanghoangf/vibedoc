# T173: Suite runner + API: run every done task's spec in one go
**Status:** ✅ Done
**Phase:** R064 — Regression suite
**Size:** M
**Depends on:** T172
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
VibeDoc runs the specs of all done tasks as one suite and keeps a per-task result: which tasks passed, which broke, and at which step. The state streams over SSE for the UI.

## Context
- Epic: `plans/roadmap/R064-regression-suite.md`
- Scope decision: this epic only does **run all done-task specs**. "Run only related", a separate report/MCP tool and a health view are out of scope for R064.
- One Playwright process for the whole suite, using `VIBEDOC_TASK_MAP` from the previous task.
- Reuse the T157 runner in `src/lib/test-runner.ts`: spawn in its own process group, `killGroup`, output tail, one entry per root on `globalThis`. **A suite and a single-task run share the same one-run-per-project lock.** Starting either while the other runs → 409.
- Guard sequence and frontend start/stop are like `POST /api/tasks/run` (`src/app/api/tasks/run/route.ts`): same-origin + JSON checks, 404 without a frontend, 409 without Playwright, `ensureFrontend`, stop the app afterwards only if this run started it, and `isDemo()` → `demoForbidden()`.
- CLAUDE.md: only `src/lib/core.ts` touches fs. Routes call `emitUpdate()`, never core.

## Scope
- [ ] Pure `collectSuite(tasks, appDir)` in a new `src/lib/suite.ts`: done tasks whose `manualTests.spec` is set. It returns `{ taskId, title, specRel }[]` sorted by task id, plus `skipped` (done tasks without a spec, as a count). Specs outside the app Dir are skipped with a reason.
- [ ] Pure `applySuiteEvent(state, event)` in `src/lib/suite.ts`. State is `{ kind: "suite", state: running | passed | failed | cancelled | error, startedAt, endedAt?, tasks: { taskId, status: queued | running | passed | failed, steps, failedStep?: { index, name, error } }[], tail }`. A task fails if any of its tests fails. The suite fails if any task fails.
- [ ] `test-runner.ts`: `startSuite({ root, cwd, entries, onEvent })` spawns `npx playwright test <spec…> --reporter=list,<reporter>` with `VIBEDOC_TASK_MAP` and `VIBEDOC_PROJECT`. `runState(root)` returns either kind, so the existing single-run UI can tell a suite is going ("Suite is running").
- [ ] Routes: `POST /api/suite/run` (202 + state, 409 if the suite is empty or any run is going), `GET /api/suite/run`, `POST /api/suite/run/cancel`. SSE event `suite_run` with the state, throttled to step boundaries like `test_run`. On the end event, emit once more with the final state so the board refreshes.
- [ ] When the suite ends, write each task's result into its task file the way T160 does for a single run (the same writer in core). Tasks that were not reached (cancelled) are left untouched.
- [ ] Self-check `src/lib/suite.check.mts`: collect (done only, spec only, sort, skipped count), event folding across two tasks, one failing task → suite failed, and cancel.

**Out of scope:** UI (next task), choosing a subset of specs, retries / flaky detection (R065), CI.

## Files
- `src/lib/suite.ts` + `suite.check.mts`: new, pure
- `src/lib/test-runner.ts`: `startSuite`, shared lock, `kind` in the state
- `src/app/api/suite/run/route.ts`, `src/app/api/suite/run/cancel/route.ts`: new
- `src/lib/core.ts`: reuse the T160 result writer per task, no new fs code paths if avoidable

## Implementation notes
- Many specs means a long command line. Pass the spec list as args, and if it is over ~100 entries, fall back to a temp `--grep`-free approach: write a list file through core and use Playwright's positional filters in chunks. Mention it in the code only if you implement it; ~100 is plenty for now.
- Exit code 1 = test failures (`failed`). Any other non-zero code with no `end` event = `error` with the tail, the same as T157.

## Acceptance criteria
- [ ] `curl -XPOST localhost:3000/api/suite/run -H 'content-type: application/json' -d '{}'` → 202. `GET /api/suite/run` shows tasks going queued → running → passed/failed, and the final state is set. Each run task gets a new run dir under `~/.vibedoc/runs/vibedoc/<task>/`.
- [ ] Break one step's expectation in a done task's spec → that task is `failed` with `failedStep` name + error, the other tasks pass, and the suite is `failed`.
- [ ] While the suite runs, `POST /api/tasks/run` → 409, and the reverse too. Cancel → `cancelled`, and no `playwright test` process is left.
- [ ] `node src/lib/suite.check.mts` prints ok. Lint stays at the baseline and the build passes.

## Verify
```bash
node src/lib/suite.check.mts
pnpm lint && pnpm build
curl -s -XPOST localhost:3000/api/suite/run -H 'content-type: application/json' -d '{}'
sleep 20; curl -s localhost:3000/api/suite/run | jq '{state, tasks: [.tasks[] | {taskId, status}]}'
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] `curl -XPOST localhost:3000/api/suite/run -H 'content-type: application/json' -d '{}'` → 202 with every done task that has a spec (here T155) and `skipped` = done tasks without one; `GET /api/suite/run` goes starting → running → passed, and the task gets a new run dir and `Auto: passed <today>`
- [ ] Point a done task at a spec with a wrong expectation and run the suite → that task is `failed` with `failedStep` (index, name, error), the others pass, the suite is `failed`, and its file reads `Auto: failed <today>` (agent checked with a throwaway spec on T153, since restored)
- [ ] While the suite runs, `POST /api/tasks/run` → 409 "The regression suite is running"; while a single Run goes, `POST /api/suite/run` → 409 "A run is already going: T0xx"
- [ ] Start the suite and `POST /api/suite/run/cancel` → cancelled, no playwright process left, no half-written run folder, and no task file changes
### Regression risk
- [ ] Run tests on /manual-tests (single task, with its honesty check) still works as before
- [ ] Settings → Frontend app → Start / Stop app and the smoke test still work
