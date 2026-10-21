# T572: Crash restart with crash-loop give-up; Done-when e2e and close the epic
**Status:** 👀 Review
**Phase:** R109 — Background mode
**Size:** M
**Depends on:** T571
**Covers:** S5
**Owner:** ai:worker-c-mvgtml325ef8
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
A background VibeDoc that crashes is back at the same address within a few seconds. After repeated crashes it stays down, and `vibedoc status` shows why. This task also proves the epic's Done when end to end.

## Context
- Epic: `plans/roadmap/R109-background-mode.md`. This task builds spec ADDED `Crash restart`, scenario "Crash loop".
- The supervisor (T1) watches `next start`. On an exit it didn't ask for (any exit while `state` is not `stopped`), it restarts `next start` with the same `PORT` and env after a backoff of 1 s, 2 s, then 4 s. Each crash is appended to `restarts: [{at, code, signal}]`.
- Crash loop: 5 crashes within 60 s → stop retrying, set `state: "crashed"` and `lastError` ("exited with code N, 5 times in 60 s" plus the last ~10 log lines), and exit the supervisor. `status` (T2) already prints `lastError`. Add a hint: `See the log: … · Start again: vibedoc start`.
- A restart doesn't touch workers. They are detached and re-adopted on boot (T556), which is the point. Only `stop` kills them (T3).
- `vibedoc start` after `crashed` starts fresh and clears `restarts` and `lastError`.

## Scope
- [ ] `bin/supervisor.mjs`: the restart loop with backoff and the give-up rule. Pure `nextAction(restarts, now)` returns `{restartInMs} | 'give-up'` (+ check).
- [ ] `bin/server-state.mjs`: `formatStatus` gets the crashed variant with the hint.
- [ ] `e2e/background-mode.mjs`, crash part. SIGKILL `serverPid` (Windows: `taskkill /F`) → within 10 s `/api/projects` answers again on the same port with a new `serverPid`. Kill it 5 times quickly → `status` exits 3 and prints the last error, and the supervisor pid is gone.
- [ ] Done-when run in the same e2e, in order: `start` → the parent exits → the app answers → an MCP `tools/call vibedoc_get_status` against the printed MCP URL answers → `stop` → no supervisor, server, worker or test-run pid is alive.
- [ ] Site docs: a short "Background mode" section on the CLI page (start / status / stop, crash restart, where the log is), and a troubleshooting entry for "VibeDoc keeps crashing" that points at the log.
- [ ] Close the epic: every scenario S1–S5 has its step in the task's Manual tests, and the epic status goes to done after review (the human merges the spec changes).

**Out of scope:** start at login (R110), a tray icon, notifications on a crash.

## Files
- `bin/supervisor.mjs`, `bin/server-state.mjs` (+ `bin/supervisor.check.mts`: new)
- `e2e/background-mode.mjs`
- `site/src/content/docs/docs/troubleshooting.md`, the site CLI/getting-started page

## Acceptance criteria
- [ ] S5: after one SIGKILL of the server, VibeDoc answers at the same address within 10 s, and an open MCP connection's next call works.
- [ ] Spec "Crash loop": after 5 crashes within 60 s, the supervisor exits, `status` exits 3, and `Last error` shows the exit code plus log lines.
- [ ] A worker running during a crash restart is still running afterwards and its chat follows it (T556 behaviour kept).
- [ ] `node bin/supervisor.check.mts` covers the backoff sequence, 4 crashes (still restarting), 5 crashes within 60 s (give up), and 5 crashes spread over 2 min (still restarting).
- [ ] The epic's Done when passes in `e2e/background-mode.mjs`.

## Verify
```bash
node bin/supervisor.check.mts && node bin/server-state.check.mts
pnpm lint && pnpm build && pnpm --dir site build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH node e2e/background-mode.mjs
```

## Manual tests
_2026-10-20 — human_
### Steps
- [ ] S5 — WHEN the background VibeDoc crashes → THEN it is back at the same address within a few seconds; after repeated crashes it stays down and `status` shows why
