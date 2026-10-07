# T272: Reopen the last page used
**Status:** 👀 Review
**Phase:** R082 — Smart first screen
**Size:** S (~1 hr)
**Depends on:** T270
**Covers:** S3
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
On a set-up project, later runs open where the user left off (e.g. /roadmap), not always the board.

## Context
- Epic: `plans/roadmap/R082-smart-first-screen.md`
- Decisions from the breakdown:
  - The last page is a per-browser cookie `vibedoc-last` (like `vibedoc-lang` in `src/app/layout.tsx` / `src/lib/i18n.ts`; CLAUDE.md bans `localStorage`). Value = the pathname only (no query), e.g. `/roadmap`. One value per browser, not per project.
  - Written by the `(app)` layout on every pathname change, except `/start` and `/setup`.
  - `/` uses it only when `firstScreen()` says `'board'`; it is validated against an allow-list of top-level `(app)` routes (pure helper in `src/lib/first-screen.ts`), else `/board`.

## Scope
- [ ] Pure `lastPageTarget(cookie: string | undefined): string` in `src/lib/first-screen.ts` + cases in its check
- [ ] Write the cookie in `src/app/(app)/layout.tsx` (path=/, a year, SameSite=Lax)
- [ ] Read it in `src/app/page.tsx` via `cookies()`
- [ ] Extend `e2e/first-screen.mjs`: on a set-up fixture visit `/roadmap`, then open `/` → `/roadmap`; a set-up project never shows the welcome

**Out of scope:** Remembering filters or scroll; per-project last page.

## Files
- `src/lib/first-screen.ts`, `src/lib/first-screen.check.mts`
- `src/app/(app)/layout.tsx`
- `src/app/page.tsx`
- `e2e/first-screen.mjs`

## Implementation notes
- Build the allow-list from the known routes (board, roadmap, docs, graph, chat, memory, activity, manual-tests, explorer, settings, getting-started); `/start` and `/setup` never count.
- An unknown or malformed cookie → `/board`, never a redirect loop.

## Acceptance criteria
- [ ] After visiting /roadmap, opening `/` on a set-up project lands on /roadmap
- [ ] A bad cookie value lands on /board
- [ ] Check + e2e pass

## Verify
```bash
node src/lib/first-screen.check.mts
pnpm build && pnpm lint
BASE=http://localhost:3082 PW_DIR=. node e2e/first-screen.mjs
```

## Manual tests
_2026-10-07 — ai · Spec: `e2e/vibedoc/T272-reopen-last-page.spec.ts` · Auto: passed 2026-10-07_
### Steps
- [ ] S3 — WHEN VibeDoc opens a project that already has tasks or a roadmap → THEN it opens the board (or the last page used), not the welcome
- [x] 🤖 Open VibeDoc on a set-up project for the first time → the board opens
- [x] 🤖 Go to Roadmap, then open VibeDoc again → the roadmap opens, not the board
- [x] 🤖 Open the setup wizard, then open VibeDoc again → still the roadmap (the wizard is never reopened)
- [ ] Stop `vibedoc`, start it again → the browser opens on the page you used last
### Regression risk
- [ ] Deep links still open as given (`/board?task=T001`, `/roadmap?item=R002`), not the remembered page

## Notes
- Only the top-level route is remembered (`/docs/x` → `/docs`), no query. One value per browser, not per project (as planned).
- The demo always opens `/board` (some pages are blocked there).
