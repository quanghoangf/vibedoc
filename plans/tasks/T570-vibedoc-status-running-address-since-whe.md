# T570: `vibedoc status`: running, address, since when, log file
**Status:** 👀 Review
**Phase:** R109 — Background mode
**Size:** S
**Depends on:** T569
**Covers:** S3
**Owner:** ai:worker-c-mvgtml325ef8
**Due:** 2026-10-21
**Started:** 2026-10-20

## Goal
`vibedoc status` says in a few lines whether VibeDoc runs in the background and where: address, since when and log file. Otherwise it says it is not running, and why when there is a reason.

## Context
- Epic: `plans/roadmap/R109-background-mode.md`. This task builds spec ADDED `Stop and status` (the status half; T3 builds stop).
- Source of truth: `<home>/server.json` (T1 shape) plus a live check. `isAlive(supervisorPid)` and `probeVibedoc(port)` must both pass before it reports "running". A stale file (dead pid) means "not running", and `status` doesn't rewrite it.
- A foreground VibeDoc, which has no `server.json` but answers on the home port, shows as "running in the foreground (not started with `vibedoc start`)".
- Exit codes, so scripts and R110 can use it: 0 when running, 3 when not running (the LSB convention).
- `--json` prints the state object plus `{ running: boolean, mode: "background"|"foreground"|null }`.

## Scope
- [ ] `bin/vibedoc.mjs`: `status` subcommand. It doesn't start anything or open a browser.
- [ ] `bin/server-state.mjs`: pure `formatStatus(state, live)` returns the lines (+ check).
- [ ] Text when running: `● VibeDoc is running at http://localhost:3333`, `  since 2026-10-20 14:02 (3 h 12 min)`, `  log: ~/.vibedoc/logs/server.log` (show home as `~`).
- [ ] Text when not running: `○ VibeDoc is not running`, plus `Last error: …` when `lastError` is set (T4 fills it on a crash loop) and a hint `Start it with: vibedoc start`.
- [ ] Docs: the getting-started "Run in the background" section gets a line on `status`.

**Out of scope:** stop (T3), crash details beyond showing `lastError` (T4).

## Files
- `bin/vibedoc.mjs`, `bin/server-state.mjs` (+ check)
- `e2e/background-mode.mjs`
- `docs/getting-started.md`, the site docs page

## Acceptance criteria
- [ ] S3: after `vibedoc start`, `vibedoc status` exits 0 and prints the address, the start time and the log path.
- [ ] With nothing running, it exits 3 and prints "not running". A `server.json` with a dead `supervisorPid` also counts as not running.
- [ ] A foreground `vibedoc` shows as running in the foreground.
- [ ] `--json` prints valid JSON with `running`.
- [ ] The check covers `formatStatus` for running, not running, and not running with `lastError`.

## Verify
```bash
node bin/server-state.check.mts
pnpm lint && pnpm build
node e2e/background-mode.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S3 — WHEN the user runs `vibedoc status` → THEN it says running (address, since when, log file) or not running
- [ ] With no VibeDoc running, run `vibedoc status; echo $?` → `○ VibeDoc is not running`, `Start it with: vibedoc start`, exit code 3
- [ ] Run `vibedoc start --no-open`, then `vibedoc status` → `● VibeDoc is running at http://localhost:<port>`, a `since <date time> (<uptime>)` line, and `log: ~/.vibedoc/logs/server.log` with your home folder shown as `~`
- [ ] Run `vibedoc status --json` → valid JSON with `"running": true`, `"mode": "background"`
- [ ] Stop the background server, run plain `vibedoc --no-open`, then `vibedoc status` in another terminal → `running in the foreground at … (not started with \`vibedoc start\`)`
### Regression risk
- [ ] `vibedoc start` and plain `vibedoc` still start and reuse a running VibeDoc as before

## Verification
_2026-10-20 — ai:claude · at 0dc7bdb_
- [minor] AC "A foreground `vibedoc` shows as running in the foreground" — When the supervisor is alive but the app doesn't answer yet (state starting / restarting), status falls through to the foreground probe on the same port, so it says "not running" (or "in the foreground" if the app comes up between the two probes) instead of mentioning the live supervisor · `bin/vibedoc.mjs:126`
- [minor] AC "The check covers formatStatus …" / S3 — Not verified: I couldn't run `node bin/server-state.check.mts` or `e2e/background-mode.mjs` in this session because shell execution needed approval. I read the code and tests; they cover running, foreground, not running, a stale file, lastError and --json
