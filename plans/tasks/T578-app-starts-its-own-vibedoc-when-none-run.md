# T578: App starts its own VibeDoc when none runs, and stops only that one on quit
**Status:** 👀 Review
**Phase:** R111 — Desktop app window
**Size:** M
**Depends on:** T577
**Covers:** S3, S2
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
With nothing running, opening the app starts VibeDoc, shows a "Starting VibeDoc…" screen until it is ready, then shows the board. Quitting the app stops that VibeDoc. A VibeDoc the app didn't start is never stopped.

## Context
- Epic: `plans/roadmap/R111-desktop-app-window.md`. The "compare" block in the epic says: background running → reuse, never stop; nothing running → start, stop on quit.
- The app starts the hub as a **child process it owns**: the same entry the CLI uses, `bin/vibedoc.mjs --no-open`, run with Electron's own Node (`process.execPath` + `ELECTRON_RUN_AS_NODE=1`), so no separate Node install is needed to run from source. Packaging the server into the app is R112.
- The app never runs `vibedoc start` (R109). A background VibeDoc should outlive the app, but one the app started should not.
- Race: the probe says nothing is running, but by spawn time something answers on the port. That counts as "someone else's" VibeDoc: use it, and don't stop it on quit.
- The menu status line says "Started by this app" or "Using VibeDoc at …" (en / vi).

## Scope
- [ ] `desktop/server.mjs`: `ensureServer({ home })` → `{ url, owned: boolean, child? }`; probe first, else spawn, then wait until ready (reuse `waitUntilReady` from T233 in `bin/`)
- [ ] `desktop/starting.html`: the "Starting VibeDoc…" screen, shown while waiting. A start failure shows the reason and the last log lines, plus a Retry button.
- [ ] On `before-quit`: when `owned`, stop the child and its process tree, wait up to ~5 s, then force-kill. When not owned, do nothing.
- [ ] The child's output goes to `<home>/logs/desktop-server.log`. Add this path to CLAUDE.md's outside-the-project list.
- [ ] `docs/desktop-app.md`: a "When nothing is running" section

**Out of scope:** links and notifications (T3), restarting a crashed child (R109 owns crash recovery for background mode).

## Files
- `desktop/server.mjs`, `desktop/starting.html`: new
- `desktop/main.mjs`: use `ensureServer`, replacing T1's not-running page (delete `not-running.html`)
- `bin/vibedoc.mjs`: only if `--no-open` from a non-repo cwd doesn't start a plain hub today. Spawn with `cwd` = the home directory; if the CLI insists on a repo, add a `--hub` flag that starts the hub with no project to add.
- `e2e/desktop-app.mjs`: S3 and the owned / not-owned quit cases

## Implementation notes
- Windows: `child.kill()` doesn't kill the tree. Use `taskkill /pid <pid> /T /F` as the fallback, and `detached: false`, so an app crash takes the child down too.
- Check `bin/vibedoc.mjs` for a SIGINT / SIGTERM handler that stops `next start`. Send the signal the CLI already handles, so Ctrl+C and app quit go through one path.

## Acceptance criteria
- [ ] S3: with nothing running (temp `VIBEDOC_HOME`, free port), opening the app shows the starting screen, then the board. After the app quits, nothing listens on the port and no `next start` process is left (e2e).
- [ ] S2: with a hub started outside the app, quitting the app leaves it answering 200 (e2e, kept from T1).
- [ ] A start failure (e.g. a bad `VIBEDOC_HOME`) shows the reason and Retry, not a blank window.
- [ ] The status line says "Started by this app" vs "Using VibeDoc at …" correctly in both cases.

## Verify
```bash
pnpm lint && pnpm build
node e2e/desktop-app.mjs
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [x] S2 — WHEN VibeDoc already runs in the background and the user opens the app → THEN the app shows it, no second VibeDoc starts, and closing the app leaves it running
- [x] S3 — WHEN nothing is running and the user opens the app → THEN the app starts VibeDoc, shows the board when it is ready, and quitting the app stops it
- [ ] With nothing running, `pnpm --dir desktop start` → "Starting VibeDoc…" for a few seconds, then All projects / the board; the VibeDoc menu reads "VibeDoc at http://localhost:3333 · started by this app"
- [ ] Quit the app (⌘Q) → `vibedoc status` says not running and nothing listens on 3333
- [ ] Run `vibedoc start` first, then open and quit the app → the menu reads "Using VibeDoc at …" and `vibedoc status` still says running
- [ ] Close the window on macOS (not quit) → the app stays in the Dock and its VibeDoc keeps running; the Dock icon reopens the board
- [ ] Kill the app’s VibeDoc (`lsof -ti tcp:3333 | xargs kill`) → the window says "VibeDoc couldn’t start / VibeDoc stopped (exit code …)" with Try again; Try again → it starts again
### Regression risk
- [ ] `vibedoc` in a terminal while the app’s own VibeDoc runs → "already running", no second server
- [ ] _`e2e/desktop-app.mjs` passes: S2 (hub from outside stays up after quit), S3 (starting screen seen, owned status line, one listener, its pid gone after quit), a failed start (VIBEDOC_HOME is a file) shows the reason + Try again. Screenshots checked: starting (vi), failed (en). Windows / Linux not run (taskkill path untested)._
