# T157: Runner: run a task's spec from the server, with live step events
**Status:** 📋 Todo
**Phase:** R061 — Run tests from VibeDoc
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
VibeDoc can run one task's Playwright spec itself and stream each step's start and result to the browser over SSE, so later tasks can show a live Run without a terminal.

## Context
- Epic: `plans/roadmap/R061-run-tests-from-vibedoc.md`
- Interview decisions:
  - **Live progress comes from a VibeDoc Playwright reporter**, passed with `--reporter`. It is not parsed from free-form stdout and not tied to the fixture. The reporter lives in this repo, so the target repo installs nothing. It gets `onStepBegin` / `onStepEnd` for every `test.step` (`step.category === 'test.step'`), and the fixture's `step()` uses `test.step` under the hood, so both styles report.
  - **One run at a time per project**, plus **Cancel**.
  - **Setup failures** (spec not found, server won't start, Playwright missing) keep the last ~40 output lines for the UI.
- Reuse the R057 plumbing:
  - `detectFrontend`, `frontendAppDir`, `detectPlaywright` and `readFrontendStartTimeoutSec` in `src/lib/core.ts`.
  - `ensureFrontend` in `src/lib/frontend-server.ts`: it reuses a running app, else starts it. The smoke route `src/app/api/frontend/smoke/route.ts` shows the full guard sequence.
- The spec path is `task.manualTests.spec`, relative to the repo root (with the app Dir in front in a monorepo). Run it from the app Dir with the path relative to that Dir.
- CLAUDE.md rules:
  - Only `src/lib/core.ts` touches fs. Process handling lives in a lib like `frontend-server.ts` ("process handling only, no fs").
  - Call `emitUpdate()` from routes, never from core.

## Scope
- [ ] `src/testing/vibedoc-reporter.ts`: a Playwright `Reporter`. On `onStepBegin` / `onStepEnd` (test.step only) and on `onEnd`, it writes one line to stdout: `@@vibedoc {json}` with `{ type: "step-begin" | "step-end" | "end", index, name, status?, error?, result? }`. `index` counts top-level steps in order. The error is the first line of `step.error.message`, ANSI stripped.
- [ ] `src/lib/test-runner.ts` (process only, like `frontend-server.ts`):
  - `startRun({ root, taskId, cwd, specRel, onEvent })` spawns `npx playwright test <specRel> --reporter=list,<abs reporter path>` with env `VIBEDOC_PROJECT=<root>`, `VIBEDOC_TASK_ID=<taskId>`, in its own process group.
  - It parses `@@vibedoc` lines into events, keeps the output tail, and keeps one entry per root on `globalThis` (a second start → error "A run is already going: T0xx").
  - `cancelRun(root)` kills the group. `runState(root)` → `{ taskId, steps, startedAt, state: running | passed | failed | cancelled | error, tail }`. The last finished state is kept until the next start.
- [ ] Pure parse of the reporter line in `src/lib/test-run-events.ts` (`parseRunLine`, `applyEvent(state, event)`), with `test-run-events.check.mts`.
- [ ] `POST /api/tasks/run` `{ id }`:
  - Same-origin and JSON checks as the smoke route.
  - 404 when there is no frontend, 409 when Playwright is missing or the task has no spec, 409 when a run is going.
  - `ensureFrontend`, then `startRun`. Returns 202 with the state.
  - `GET /api/tasks/run` → `runState`. `DELETE` is not allowed (RPC style is fine): use `POST /api/tasks/run/cancel`.
  - Every event → `emitUpdate("test_run", { taskId, state })`. Stop the app afterwards only if this run started it (like smoke).
- [ ] Demo mode refuses POSTs (`isDemo()` → `demoForbidden()`).

**Out of scope:** any UI (T159, T161), writing the result into the task file (T160), and the fixture kit in the target repo (T158).

## Files
- `src/testing/vibedoc-reporter.ts`: new.
- `src/lib/test-runner.ts`: new; spawn and kill. Copy `killGroup` / the detached-group pattern from `frontend-server.ts`, or export it from there.
- `src/lib/test-run-events.ts` + `.check.mts`: new, pure.
- `src/app/api/tasks/run/route.ts`, `src/app/api/tasks/run/cancel/route.ts`: new.

## Implementation notes
- Reporter path: Playwright can load a `.ts` reporter from an absolute path outside node_modules (it transpiles it). Resolve it from VibeDoc's install dir: `path.join(process.cwd(), 'src/testing/vibedoc-reporter.ts')` in dev. For the npm package, add it to `tsconfig.playwright.json` `files` and use `dist/testing/vibedoc-reporter.js` when the src file is absent. Check both.
- `--reporter=list,<path>`: Playwright accepts a comma-separated list. Keep `list` so the tail is readable.
- `npx` must run the target's Playwright: run from the app Dir, never from VibeDoc's cwd.
- Exit code 1 = test failure (state `failed`, not `error`). Any other non-zero code with no `end` event = `error` with the tail.

## Acceptance criteria
- [ ] `curl -XPOST localhost:3000/api/tasks/run -H 'content-type: application/json' -d '{"id":"T155"}'` → 202. `GET /api/tasks/run` shows the steps going from running to passed, and the final state is `passed`. A new run dir appears under `~/.vibedoc/runs/vibedoc/T155/`.
- [ ] A second POST while running → 409 naming T155. `POST /api/tasks/run/cancel` → the state is `cancelled` and no playwright process is left (`pgrep -f "playwright test"` is empty).
- [ ] A task without a spec → 409. A bad spec path → state `error` with a tail that contains Playwright's "No tests found".
- [ ] `node src/lib/test-run-events.check.mts` prints ok.

## Verify
```bash
node src/lib/test-run-events.check.mts
pnpm lint && pnpm build
curl -s -XPOST localhost:3000/api/tasks/run -H 'content-type: application/json' -d '{"id":"T155"}'
sleep 8; curl -s localhost:3000/api/tasks/run | jq '{state, steps: [.steps[].status]}'
```
