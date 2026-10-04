# T142: Dev server lifecycle: reuse if up, else spawn
**Status:** ✅ Done
**Phase:** R057 — Frontend app detection
**Size:** M
**Depends on:** T139
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
VibeDoc can make sure the frontend is reachable: it reuses a dev server that is already running at the URL, otherwise it starts the app with its start command, waits until it responds, and stops it afterwards.

## Context
- Epic: `plans/roadmap/R057-frontend-app-detection.md`
- Decided: spawn and reuse. Login (T6) and smoke (T7) call this. Never kill a server VibeDoc didn't start.

## Scope
- [ ] A server-side module `ensureFrontend(app)` → `{ url, startedByUs, stop() }`
- [ ] Probe: GET the URL (short timeout); any HTTP response counts as up
- [ ] When down: spawn `startCommand` in the root (shell, own process group), capture the last ~200 lines of output, and poll the URL until it responds or 60s pass (configurable via `settings.frontend.startTimeoutSec`)
- [ ] Timeout or early exit → error with the output tail
- [ ] `stop()` kills the process group, only if `startedByUs`. Also stop on VibeDoc shutdown
- [ ] Settings shows the live state (running / stopped / starting) with Start and Stop buttons via `POST /api/frontend/server {action}` + `emitUpdate()`

**Out of scope:** running tests (T7, R058), managing several apps at once.

## Files
- `src/lib/frontend-server.ts`: new; process handling only, no `fs`
- `src/app/api/frontend/server/route.ts`: new
- `src/app/(app)/settings/page.tsx`: state + buttons

## Implementation notes
Keep a singleton per project root (like the event bus in `src/lib/events.ts`) so two requests don't spawn two servers. On macOS/Linux use `detached: true` and `process.kill(-pid)` to kill the group, because dev servers spawn children.

## Acceptance criteria
- [ ] App already running → Start reports "reused", and Stop is disabled
- [ ] App down → Start brings it up, the URL responds, Stop kills it, and the port is free afterwards
- [ ] A broken start command → error shown with output, no orphan process

## Verify
```bash
npm run lint && npm run build
# /settings → Start → curl <app url> → Stop → lsof -i :<port> shows nothing
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Point VibeDoc at a project whose frontend is not running. Open Settings → Frontend app → Dev server and click Start. The pill shows "Starting…" with "Waiting for the URL to respond…", then "Running". Stop is enabled and Start is disabled.
- [ ] Start the app yourself in a terminal, reload Settings and click Start. The pill shows "Running · reused" with a toast, and Stop stays disabled with the "VibeDoc didn't start this server" tooltip.
- [ ] Set a broken `startCommand` override (for example a command that does not exist). Start shows the red error line and the output panel, and no process is left behind (`ps`/`lsof` show nothing).
- [ ] Put `"startTimeoutSec": 5` under `frontend` in `.vibedoc/settings.json` with a command that never serves the URL. Start fails after about 5s with "didn't respond within 5s". Saving an override in the form afterwards keeps `startTimeoutSec` in the file.
- [ ] Open Settings in two tabs and click Start in one. The other tab follows (Starting → Running → Stopped on Stop) without a reload.
- [ ] Start the app from VibeDoc, then stop VibeDoc (Ctrl-C). The app's port is free afterwards.
### Regression risk
- [ ] Frontend app override form: Save and "Reset to detected" still work, and Reset leaves `frontend` holding only `startTimeoutSec` (or removes it when that was never set).
- [ ] The Playwright row (T141) still shows its status pill and Install works. The new Dev server row sits above it without changing its layout.
- [ ] For VibeDoc's own repo (default root), Start reports "reused" for :3000 and never spawns a second VibeDoc.
