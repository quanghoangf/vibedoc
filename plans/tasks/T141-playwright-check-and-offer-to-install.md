# T141: Playwright check and offer to install
**Status:** ✅ Done
**Phase:** R057 — Frontend app detection
**Size:** M
**Depends on:** T138
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
VibeDoc tells the user whether the frontend app has Playwright, and offers a one-click install when it doesn't, so later login/smoke/auto-tests have a runner.

## Context
- Epic: `plans/roadmap/R057-frontend-app-detection.md`
- Playwright is resolved from the **target** project's node_modules (the FE app dir, then the root), not VibeDoc's. That is the same idea as the `PW_DIR` pattern in this repo's `e2e/*.mjs`.
- Spawning processes from a route has a precedent: `src/app/api/chat/route.ts` spawns `claude -p`. File reads still go through `core.ts`.

## Scope
- [ ] Extend detection: `playwright: { installed: boolean, version?: string, browsersInstalled?: boolean }` from `@playwright/test` / `playwright` in the app's or root's package.json and node_modules
- [ ] Settings section: a status pill; when missing, show the exact command (`<pm> add -D @playwright/test && npx playwright install chromium`, run in the app dir) with Copy and **Install** buttons
- [ ] `POST /api/frontend/playwright/install` runs the command in the app dir, streams the output to the UI (SSE or a streamed response, following how chat streams), and calls `emitUpdate()` when done
- [ ] Only one install at a time; a second request → 409
- [ ] Install failure → show the tail of the output, and leave package.json untouched if the pm failed

**Out of scope:** writing a playwright.config or any specs (R058).

## Files
- `src/lib/core.ts`: Playwright detection helpers
- `src/app/api/frontend/playwright/install/route.ts`: new
- `src/app/(app)/settings/page.tsx`: status and install UI

## Implementation notes
To check browsers, `npx playwright install --dry-run chromium` exists in recent versions. If that's unreliable, treat browsers as unknown and always run `install chromium` as part of Install.

## Acceptance criteria
- [ ] A fixture without Playwright → "Not installed" with the right command for its package manager
- [ ] Clicking Install on a real test app adds `@playwright/test` to the app's devDependencies and the pill turns "Installed vX"
- [ ] An app that already has it → "Installed vX", no button

## Verify
```bash
npm run lint && npm run build
VIBEDOC_ROOT=<scratch vite app> npm run dev   # /settings → Install → check package.json
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Open /settings → Frontend app on a project whose app has no Playwright. The Playwright row shows a grey "Not installed" pill and the command for that project's package manager (pnpm add / npm install -D / yarn add / bun add -d). Copy puts exactly that command on the clipboard and a toast appears.
- [ ] Click Install. Output streams into the log box, the button reads "Installing…", and when it finishes the pill becomes green "Installed vX" with no button. Check that the app's package.json has `@playwright/test` in devDependencies.
- [ ] In a monorepo (e.g. apps/web), click Install. Confirm the package is added to the app package's package.json (apps/web/package.json), not the root.
- [ ] Temporarily rename ~/Library/Caches/ms-playwright (or set PLAYWRIGHT_BROWSERS_PATH to an empty dir). On an app that has Playwright, the pill should read amber "Installed vX · Chromium missing" and Install should only run `npx playwright install chromium`.
- [ ] Break the install (e.g. turn off the network, or add an unknown dependency). A red "Install failed. Last output:" appears with the tail of the output, and package.json is unchanged.
- [ ] Ask an agent for `vibedoc_get_frontend`. The Playwright line shows "installed vX" or "not installed (run in <dir>: `...`)".
- [ ] From another site (or `curl -X POST` with no JSON content type / a foreign Origin), POST /api/frontend/playwright/install is refused (415 / 403) and nothing is spawned. With VibeDoc's own repo as root it returns 400.
### Regression risk
- [ ] The rest of Settings → Frontend app still works: the detected-app table, notes, and the override form's Save and Reset (GET /api/frontend now also runs detectPlaywright).
- [ ] VIBEDOC_DEMO=1: POST /api/frontend/playwright/install is refused (demo forbidden) and nothing is spawned.
