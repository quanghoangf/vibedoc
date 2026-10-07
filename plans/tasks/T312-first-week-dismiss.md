# T312: Dismiss per project, and a finished state
**Status:** 📋 Todo
**Phase:** R084 — First-week checklist
**Size:** S (~1 hr)
**Depends on:** T310
**Covers:** S3

## Goal
The user can dismiss the checklist and it never comes back for this project; when every step ticks it says so once and then leaves the sidebar.

## Context
- Epic: `plans/roadmap/R084-first-week-checklist.md`
- Decision: dismissal is stored per project in `.vibedoc/first-week.json` (`{ "dismissed": "<ISO time>" }`), not in `.vibedoc/settings.json` (the Settings page writes that file whole from its own state and would drop the key).
- Finished: derived. A checklist that loads already complete is not shown; one that becomes complete while open shows "All done" with a Close button (Close = dismiss).
- CLAUDE.md: only `core.ts` touches fs; call `emitUpdate()` after the mutation; the CLAUDE.md "No database" list of files VibeDoc writes must name the new file.
- Demo mode (`isDemo()` / `demoForbidden()` from `src/lib/demo.ts`) refuses the write.

## Scope
- [ ] `dismissFirstWeek(root)` / `restoreFirstWeek(root)` in core; `getFirstWeek()` returns `dismissed`
- [ ] `POST /api/first-week/dismiss` and `POST /api/first-week/restore`, each `emitUpdate('first_week_updated')`; `AppContext` refreshes on it (other tabs hide too); the clicking tab hides at once
- [ ] A dismiss button (✕, accessible name) in the section header; dismiss shows `undoToast()` (`components/ui/toast.tsx`) whose Undo calls restore
- [ ] Finished state as above
- [ ] CLAUDE.md: add `.vibedoc/first-week.json` to the list of files VibeDoc writes; add `/.vibedoc/first-week.json` to this repo's `.gitignore` (a dismissal is per install: a teammate who clones gets their own first week)
- [ ] Extend `e2e/first-week.mjs`: dismiss → gone; reload → still gone; another project (second fixture) still shows it

**Out of scope:** re-opening a dismissed checklist from Settings (not asked for).

## Files
- `src/lib/core.ts`
- `src/app/api/first-week/dismiss/route.ts`, `src/app/api/first-week/restore/route.ts` — new
- `src/components/layout/FirstWeek.tsx`
- `src/i18n/firstWeek.ts`
- `CLAUDE.md`, `.gitignore`
- `src/context/AppContext.tsx` — refresh on `first_week_updated`
- `e2e/first-week.mjs`

## Acceptance criteria
- [ ] Dismiss hides the checklist; after a reload or a server restart it stays hidden for this project only (S3)
- [ ] Undo brings it back
- [ ] All six ticked while open → "All done" with Close; loaded complete → not shown

## Verify
```bash
pnpm lint && pnpm build
BASE=http://localhost:3084 PW_DIR=<dir with node_modules/playwright> node e2e/first-week.mjs
```

## Manual tests
### Steps
- [ ] S3 — WHEN the user dismisses the checklist → THEN it doesn't come back for this project
