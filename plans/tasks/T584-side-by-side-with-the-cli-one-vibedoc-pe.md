# T584: Side by side with the CLI: one VibeDoc per address, whichever install started it
**Status:** 👀 Review
**Phase:** R112 — Desktop installers & auto-update
**Size:** M
**Depends on:** T581
**Covers:** S3
**Owner:** ai:claude
**Due:** 2026-10-24
**Started:** 2026-10-21

## Goal
With both the terminal install and the desktop app on one machine, only one VibeDoc ever runs at the usual address. The app uses a running terminal-install VibeDoc, and the CLI uses one the app started, instead of either starting a second.

## Context
- Epic: `plans/roadmap/R112-desktop-installers-auto-update.md`
- R111 makes the app reuse a background VibeDoc. This task covers the two-install case: different binaries, possibly different versions, and the same address (R080 stable address, R109 background mode).
- Both installs have to read and write the same runtime marker (the R109 pid/port file in the user's VibeDoc home) and identify a server with the same health endpoint.

## Scope
- [ ] The health/identity endpoint (the one R109/R111 use) reports `{ app: "vibedoc", version, startedBy: "cli" | "desktop" }`
- [ ] Desktop: before starting its bundled server, probe the address. If it finds a VibeDoc (any version), use it and say so in the window ("Using the VibeDoc running from your terminal, vX.Y.Z")
- [ ] Desktop: if the address is taken by something that isn't VibeDoc, show a clear error and don't start a second server on a random port
- [ ] CLI `vibedoc` start: if a desktop-started VibeDoc already serves the address, print that and exit 0 instead of failing with EADDRINUSE
- [ ] Version skew: if the found server is older than the app, show a non-blocking note ("Your terminal VibeDoc is vX, the app is vY")

**Out of scope:** updating the other install, or merging the two installs.

## Files
- the server health route (R109's; find it with `vibedoc_search_docs "health"`) to add `startedBy`
- `desktop/src/server.ts` (R111's start-or-reuse logic): the two-install cases
- `bin/vibedoc` CLI start path: detect the running VibeDoc

## Acceptance criteria
- [ ] CLI background VibeDoc running → open the app → still one VibeDoc process, and the app shows the board from it
- [ ] App running (it started VibeDoc) → `vibedoc` in a terminal → it reports the running one and starts nothing
- [ ] Address held by a non-VibeDoc process → the app shows an error naming the address
- [ ] Unit tests for the probe classification (vibedoc / other / free)

## Verify
```bash
pnpm test
vibedoc &               # terminal install
open -a VibeDoc         # app reuses it
ps aux | grep -c '[v]ibedoc.*server'   # one server
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [x] S3 — WHEN the user also has the terminal install running in the background → THEN the desktop app uses that VibeDoc instead of starting a second one
- [ ] `vibedoc start`, then open the installed app → the board loads; the VibeDoc menu says "Using the VibeDoc running from your terminal, v… · http://localhost:3333"; `lsof -i :3333` shows one server
- [ ] Quit the app → `vibedoc status` still says running
- [ ] With nothing running, open the app, then run `vibedoc` in a repo → "VibeDoc is already running", the repo is added, nothing new starts
- [ ] Run something else on 3333 (`python3 -m http.server 3333`), open the app → "VibeDoc couldn’t start" naming http://localhost:3333, no VibeDoc on another port
- [ ] An older terminal VibeDoc running + a newer app → one quiet notification "Your terminal VibeDoc is older" naming both versions; the app keeps working
### Regression risk
- [ ] `vibedoc` with 3333 taken by another program still moves to the next port and prints the reconnect commands (R080)
- [ ] _`node bin/address.check.mts` covers the classification (free / VibeDoc with and without /api/server / other program) on live ports. `e2e/desktop-app.mjs` section 8 passes: `vibedoc start` → app → one listener and the terminal status line, still answering after the app quits; the app’s own VibeDoc (`/api/server` startedBy desktop) → plain `vibedoc` exits 0 "already running" with one listener; an HTML server on the address → the app’s error names it. Not automated: the version-skew notification (needs two versions). The e2e cleanup now kills process trees (a killed CLI had left its next-server running on a test port once; I stopped that orphan)._
