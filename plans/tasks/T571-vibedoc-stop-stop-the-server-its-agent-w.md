# T571: `vibedoc stop`: stop the server, its agent workers and test runs
**Status:** 👀 Review
**Phase:** R109 — Background mode
**Size:** M
**Depends on:** T570
**Covers:** S4
**Owner:** ai:worker-c-mvgtml325ef8
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
`vibedoc stop` stops the background VibeDoc and everything it started (agent workers, test runs, frontend dev servers it spawned), tells the user what it stopped, and afterwards `status` says not running.

## Context
- Epic: `plans/roadmap/R109-background-mode.md`. This task builds spec ADDED `Stop and status` (the stop half), scenario "Stop".
- Since T556, workers run `detached` and **survive a VibeDoc restart** on purpose. Their pids are in `<home>/worktrees/<project>/.vibedoc-workers/<id>.json`. Killing the server alone leaves them running, so `stop` has to stop them explicitly. A crash restart (T4) must NOT do this.
- Decision: stop running workers without asking, and name them: "Stopped 2 agent runs (R108, R109). They show as Interrupted with Resume next time." T556 already turns a dead worker pid into Interrupted + Resume.
- Order of operations:

<!-- vibedoc:steps -->
- **Ask the server** — `POST /api/server/shutdown` (localhost only, header `x-vibedoc-cli: 1`, same guard as `/api/projects/add` in T534). The server stops every worker (worker-runs), every test run (test-runner) and every frontend server it started (`startedByUs` in frontend-server), then replies with what it stopped.
- **Stop the supervisor** — set `state: "stopped"` first so the supervisor doesn't restart the server, then terminate the supervisor's process tree.
- **Sweep** — if the server didn't answer within 5 s, kill the pids from the worker state files directly.
- **Confirm** — wait until no pid from `server.json` is alive and the port is free (up to 10 s), then print "✓ VibeDoc stopped".

- Cross-platform kill: on POSIX, signal the process group (`process.kill(-pid, 'SIGTERM')`, then SIGKILL after 5 s), reusing the `killGroup` pattern from `src/lib/frontend-server.ts`. On Windows, use `taskkill /PID <pid> /T /F`.
- The supervisor handles SIGTERM by stopping `next start` and exiting 0. On Windows there are no signals, so the supervisor also polls `server.json` for `state: "stopped"` every 1 s.
- Process handling stays out of core.ts. The route calls the existing stop functions in the libs, and only core.ts touches fs.

## Scope
- [ ] `src/app/api/server/shutdown/route.ts`: new. It is local-only and returns `{ workers: [{id, epic}], testRuns: n, frontends: n }`.
- [ ] `worker-runs.ts`: `stopAllWorkers()` (all hub projects). `test-runner.ts`: `stopAllRuns()`. `frontend-server.ts`: `stopAllStartedByUs()`. Reuse each lib's existing per-item stop.
- [ ] `bin/supervisor.mjs`: SIGTERM handling, and polling for the `stopped` state.
- [ ] `bin/vibedoc.mjs`: `stop` subcommand. With nothing running it prints "VibeDoc is not running" and exits 0. A foreground VibeDoc gets "running in the foreground: press Ctrl+C in its terminal" and exit 1.
- [ ] `bin/server-state.mjs`: `killTree(pid)` for POSIX and Windows (+ check where it can be tested with a child process).
- [ ] Docs: the getting-started section gets a line on `stop` and what happens to agent runs.

**Out of scope:** crash restart (T4), a confirmation prompt or `--force` (decided against).

## Files
- `src/app/api/server/shutdown/route.ts`: new
- `src/lib/worker-runs.ts`, `src/lib/test-runner.ts`, `src/lib/frontend-server.ts`
- `bin/vibedoc.mjs`, `bin/supervisor.mjs`, `bin/server-state.mjs` (+ check)
- `e2e/background-mode.mjs`
- `docs/getting-started.md`, the site docs page

## Acceptance criteria
- [ ] S4 / spec "Stop": in `e2e/background-mode.mjs`, start, then start a worker with the slow `claude` stub on PATH (as `e2e/worker-restart.mjs` does), then run `vibedoc stop`. The supervisor, the server and the stub pid are all gone, the port is free, and `status` exits 3.
- [ ] The terminal names the stopped worker. After the next `start`, that worker shows as Interrupted with Resume.
- [ ] `POST /api/server/shutdown` from a non-localhost origin, or without the header, returns 403.
- [ ] With the server hung (e2e: SIGSTOP the `next` pid on POSIX), `stop` still ends everything within 15 s through the sweep.
- [ ] `stop` with nothing running exits 0 with "not running".

## Verify
```bash
node bin/server-state.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH node e2e/background-mode.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S4 — WHEN the user runs `vibedoc stop` → THEN VibeDoc and every worker or test run it started have exited, and `status` says not running
- [ ] Run `vibedoc start`, start Work with agent on an epic, then run `vibedoc stop` → the terminal prints "Stopped 1 agent run (R…). It shows as Interrupted with Resume next time." and "✓ VibeDoc stopped"; `ps` shows no `claude` process for that worktree
- [ ] Run `vibedoc start` again and open that worker's chat → its strip says Interrupted with a Resume button; Resume continues the task
- [ ] Start a task's Run on /manual-tests (with a frontend app VibeDoc starts itself), then `vibedoc stop` → the output names 1 test run and 1 dev server; the app's dev server port is free afterwards
- [ ] Run `vibedoc stop` with nothing running → "○ VibeDoc is not running", exit code 0
- [ ] Run plain `vibedoc` in one terminal, `vibedoc stop` in another → "running in the foreground: press Ctrl+C in its terminal", exit code 1, and the foreground VibeDoc keeps running
### Regression risk
- [ ] Restarting VibeDoc without `stop` (Ctrl+C on a foreground `vibedoc`, then start again) still leaves a running worker's turn alive and adopts it afterwards (T556)
- [ ] The Stop button on a worker in /chat still stops just that worker (phase Stopped, not Interrupted)

## Verification
_2026-10-20 — ai:claude · at 9bc2cb6_
- [minor] AC2 "The terminal names the stopped worker" — When the server hangs, the sweep labels each worker with its taskId ("Stopped 1 agent run (T002)"). When the server answers, it gives the epic, which is what the documented message shows ("(R108, R109)"). Mapping the worker id to its chat's target would make both paths say the same thing. · `bin/vibedoc.mjs:181`
- [minor] AC1/AC4 e2e (S4, hung-server sweep within 15 s) — Not verified: I couldn't run `node bin/server-state.check.mts` or `e2e/background-mode.mjs` here (permission was not granted, and the e2e needs a build and the claude stub). I checked the code paths by reading them only.
