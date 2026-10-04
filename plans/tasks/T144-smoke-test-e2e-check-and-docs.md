# T144: Smoke test, e2e check and docs
**Status:** ✅ Done
**Phase:** R057 — Frontend app detection
**Size:** M
**Depends on:** T140, T143
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
A **Run smoke test** button proves the setup end to end: VibeDoc starts (or reuses) the app, opens its first page with the saved session and shows a screenshot. This meets the epic's Done when.

## Context
- Epic: `plans/roadmap/R057-frontend-app-detection.md`
- Epic Done when: "on a fresh project with a web frontend, VibeDoc shows the detected app, start command and URL, and a smoke test can open the app's first page logged in"
- Uses ensureFrontend (T5) and the storage state (T6).

## Scope
- [ ] `POST /api/frontend/smoke`: ensureFrontend → run the target's `npx playwright screenshot --load-storage=<state> <url> .vibedoc/auth/smoke.png` (skip `--load-storage` when there's no session) → stop the server if we started it
- [ ] Result: ok/fail, final URL after redirects, HTTP status, duration, screenshot. "Looks logged out" warning when the final URL contains the `loginPath`
- [ ] Settings shows the result and the screenshot (served through an API route, not `fs` in the page)
- [ ] e2e script `e2e/fe-detection.mjs` against a fixture Vite app: /settings shows the app + URL → the smoke API returns ok with a screenshot
- [ ] Docs: a "Frontend app" section in `docs/getting-started.md` (detection, override, Playwright install, login, smoke), and the new routes in the API docs

**Out of scope:** checklist-driven specs (R058), screenshots/video per test step (R059).

## Files
- `src/app/api/frontend/smoke/route.ts`: new
- `src/lib/core.ts`: read the screenshot bytes for the route
- `src/app/(app)/settings/page.tsx`: Run smoke test + result
- `e2e/fe-detection.mjs`: new, follows the existing `e2e/*.mjs` + `PW_DIR` pattern
- `docs/getting-started.md`

## Acceptance criteria
- [ ] On a fresh fixture app with the server down, Run smoke test starts it, returns ok with a screenshot of the first page, and stops it again
- [ ] With a saved session on an app that has auth, the screenshot shows the logged-in page and no "logged out" warning
- [ ] With no session, the result still works and notes "no saved session"
- [ ] `e2e/fe-detection.mjs` passes
- [ ] Every R057 Done-when point is checked off

## Verify
```bash
npm run lint && npm run build
PW_DIR=<dir with playwright> BASE=http://localhost:3000 node e2e/fe-detection.mjs
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] On a real project with a Vite/Next app that is not running, open Settings → Frontend app and click **Run smoke test**. The button shows "Running…". The Dev server pill goes Starting → Running → Stopped. The result shows Passed, the final URL, the HTTP status, a duration ending "started and stopped the app", and a screenshot of the first page.
- [ ] Set a Login path (e.g. /login) and click **Clear session** if one is saved. Then run the smoke test on an app that redirects to login. Both "Looks logged out" and "No saved session" notes show, and the screenshot is the login page.
- [ ] Click **Log in**, sign in for real in the window, close it, then run the smoke test again. The screenshot shows the logged-in page and there is no "Looks logged out" note. (Automated only with a hand-written storage-state cookie; the headed Log in window needs a human.)
- [ ] Use an app whose first page returns a 500 (or a broken start command). The pill shows Failed: with a status ≥ 400 and a screenshot, or with the start error text and no screenshot. A screenshot from an earlier run is never shown.
- [ ] On a project where Playwright is not installed in the app, the **Run smoke test** button is disabled and says to install Playwright first.
### Regression risk
- [ ] Click **Start** on the Dev server row, then run the smoke test. The server is still running afterwards and **Stop** still works. The smoke test must not kill a server the user started.
- [ ] Log in and Clear session still work, and Clear session still leaves `.vibedoc/auth/.gitignore` in place. `smoke.png` sits in the same git-ignored folder, so check that `git status` in the target project does not list it.
