# T143: Log in once in a headed browser and save the session
**Status:** ✅ Done
**Phase:** R057 — Frontend app detection
**Size:** L
**Depends on:** T141, T142
**Owner:** ai:claude-code
**Due:** 2026-10-11
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
The user logs into their app once in a real browser that VibeDoc opens. VibeDoc saves the session (Playwright storageState) and every later test reuses it.

## Context
- Epic: `plans/roadmap/R057-frontend-app-detection.md`
- Decided: headed browser, and the user logs in by hand. No stored credentials.
- Needs Playwright in the target app (T4) and a reachable app (T5).
- The session holds live cookies: it must never be committed.

## Scope
- [ ] Settings → **Log in** button: ensureFrontend, then spawn the target's Playwright CLI: `npx playwright open --save-storage=.vibedoc/auth/storage-state.json <url>[loginPath]` in the app dir
- [ ] The user logs in and closes the browser → the file is written → the UI shows "Session saved <date>"
- [ ] Write `.vibedoc/auth/.gitignore` containing `*` before the first save
- [ ] Optional `settings.frontend.loginPath` (e.g. `/login`), editable next to the URL
- [ ] **Clear session** deletes the file
- [ ] Detection gets `auth: { saved: boolean, savedAt?: string }`, which also shows up in `vibedoc_get_frontend` (T3)
- [ ] Browser closed without logging in → the file is still written. That's fine; T7's smoke test is what tells whether it's logged in
- [ ] Update the CLAUDE.md "VibeDoc writes only…" list: `.vibedoc/auth/` (storage state + .gitignore)

**Out of scope:** scripted/credential login, multiple users/roles, refreshing expired sessions automatically.

## Files
- `src/lib/core.ts`: auth file path helpers, gitignore write, clear
- `src/app/api/frontend/login/route.ts`: new (POST start, DELETE clear)
- `src/app/(app)/settings/page.tsx`: Log in / Clear session, loginPath field
- `src/app/api/mcp/route.ts`: include auth in `vibedoc_get_frontend`
- `CLAUDE.md`

## Implementation notes
The route returns right away with `{started:true}`. Watch the child's exit, then `emitUpdate()` so Settings refreshes. A headed browser needs a desktop session. If `DISPLAY` is missing on Linux, or VibeDoc runs in demo mode (`VIBEDOC_DEMO=1`), disable the button with a reason.

## Acceptance criteria
- [ ] Clicking Log in opens a Chromium window at the app's login URL
- [ ] After logging in and closing it, `.vibedoc/auth/storage-state.json` exists, `.vibedoc/auth/.gitignore` contains `*`, and `git status` doesn't list the state file
- [ ] Settings shows "Session saved", and Clear session removes it
- [ ] Playwright not installed → the button is disabled and points to Install

## Verify
```bash
npm run lint && npm run build
# /settings → Log in → log in → close → ls .vibedoc/auth && git -C <target> status --short
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] On a project that has Playwright installed and a login page, open Settings → Frontend app and set Login path to `/login`, then Save. Source should still say "Detected", not "Your override".
- [ ] Click **Log in**. If the app was stopped, it starts first. A Chromium window opens at `<app url>/login`, and the row says "Browser open: log in…" with Log in disabled.
- [ ] Log in by hand and close the window. Within a second or two the row shows "Session saved <date>". `git -C <target> status --short -uall` does not list `.vibedoc/auth/storage-state.json`, and `.vibedoc/auth/.gitignore` contains `*`.
- [ ] Ask an agent to call `vibedoc_get_frontend`. It reports `**Login path:** /login` and `**Auth:** session saved …`.
- [ ] Click **Clear session**. The row returns to "No session saved" and only `.gitignore` remains in `.vibedoc/auth/`.
- [ ] Switch to a project without Playwright. Log in is disabled and the row says to Install Playwright first.
- [ ] On a project with Playwright but no Chromium (Settings shows "Installed · Chromium missing"), Log in is disabled and says "Install Chromium first (above)". The app does not start. (Automated: POST returns 409 with PLAYWRIGHT_BROWSERS_PATH set to an empty dir.)
### Regression risk
- [ ] Override form: change only the URL or start command, then click "Reset to detected". The URL and start command still behave as before (T139). Reset also clears the login path.
- [ ] Dev server row (T142): Start and Stop still work, and a server started by Log in shows "Started by VibeDoc" and can be stopped.
