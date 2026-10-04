# T139: Monorepo detection and settings override
**Status:** ✅ Done
**Phase:** R057 — Frontend app detection
**Size:** M
**Depends on:** T138
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
Detection works in monorepos (picks the web app package), and the user can override any detected field in `.vibedoc/settings.json` when the guess is wrong.

## Context
- Epic: `plans/roadmap/R057-frontend-app-detection.md`
- Builds on `detectFrontend()` / `FrontendApp` from T1.
- Settings live in `.vibedoc/settings.json`, which VibeDoc already writes (`statuses`, `tasks.sizeDays`). Add a `frontend` key there and read/write it the same way.

## Scope
- [ ] Workspaces from `package.json` `workspaces` (array or `{packages}`) and `pnpm-workspace.yaml`; expand the globs
- [ ] Score each package: has a web framework dep (+), has a `dev` script (+), lives under `apps/` or is named web/frontend/client/app (+), Storybook/docs-only packages (−)
- [ ] The best candidate wins. Return `candidates` (dir, name, framework) so the UI can offer the rest
- [ ] Start command for a workspace package: run from the root with the pm's filter (`pnpm --filter <name> dev`, `npm run dev -w <dir>`, `yarn workspace <name> dev`)
- [ ] Override: `settings.frontend = { dir?, startCommand?, url? }`. Override fields win, and `source: 'override'` when any field is set
- [ ] Settings UI: dropdown of candidates, editable start command and URL, Save, and "Reset to detected"
- [ ] `PUT /api/frontend` saves the override and calls `emitUpdate()`
- [ ] Unit tests: pnpm monorepo with apps/web + packages/ui, npm workspaces, override precedence

**Out of scope:** separate FE repos and deployed-URL-only targets (epic out of scope).

## Files
- `src/lib/core.ts`: extend `detectFrontend()`, add `saveFrontendOverride()`
- `src/app/api/frontend/route.ts`: add PUT
- `src/app/(app)/settings/page.tsx`: editable section
- fixtures + tests next to T1's

## Implementation notes
Add `candidates?: {dir,name,framework}[]` to `FrontendApp`. Keep glob expansion simple: support `dir/*` and literal paths only, with no new dependency unless one is already installed.

## Acceptance criteria
- [ ] pnpm monorepo fixture → `apps/web` detected, start command `pnpm --filter web dev`
- [ ] Picking another candidate and saving writes `.vibedoc/settings.json` `frontend.dir`, and the UI updates live
- [ ] Overriding only `url` keeps the detected start command
- [ ] Reset removes the `frontend` key and leaves other settings untouched
- [ ] Unit tests pass

## Verify
```bash
npm run lint && npm run build
# unit tests
VIBEDOC_ROOT=<monorepo fixture> npm run dev   # /settings → change candidate → cat .vibedoc/settings.json
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Open /settings for a pnpm monorepo that has apps/web and packages/ui, then go to Frontend app. Expected: Directory is apps/web, Start command is `pnpm --filter web dev`, Source is "Detected", and the App dropdown lists every web package.
- [ ] Pick another app in the App dropdown. Expected: the start command and URL fields are disabled and a hint says they will be detected again. Click Save. Expected: the card shows the new app's own start command and port, and `.vibedoc/settings.json` contains `"frontend": {"dir": ...}`.
- [ ] Change only the URL to a different port and click Save. Expected: Source becomes "Your override", the start command stays the detected one, and settings.json has only `frontend.url`.
- [ ] With /settings open in two tabs, save an override in one tab. Expected: the other tab's Frontend app card updates without a reload.
- [ ] Click "Reset to detected". Expected: the `frontend` key is removed from settings.json, the other keys (theme, statuses, tasks) are unchanged, and the button disappears.
- [ ] Type `localhost` (no scheme) in URL and click Save. Expected: a toast says the URL must be a full URL, and nothing is written.
### Regression risk
- [ ] Save an override, then change something on the Appearance or Statuses tab without reloading the page. Expected: settings.json still has the `frontend` override, because the settings PUT now keeps the on-disk `frontend` key.
- [ ] A single-app project (not a monorepo, e.g. a Vite app at the root) still shows `pnpm run dev` / `npm run dev` as the start command with dir `.`, and there is no App dropdown.
