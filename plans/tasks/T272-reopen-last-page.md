# T272: Reopen the last page used
**Status:** 📋 Todo
**Phase:** R082 — Smart first screen
**Size:** S (~1 hr)
**Depends on:** T270
**Covers:** S3

## Goal
On a set-up project, later runs open where the user left off (e.g. /roadmap), not always the board.

## Context
- Epic: `plans/roadmap/R082-smart-first-screen.md`
- Decisions from the breakdown:
  - The last page is a per-browser cookie `vibedoc-last` (like `vibedoc-lang` in `src/app/layout.tsx` / `src/lib/i18n.ts`; CLAUDE.md bans `localStorage`). Value = the pathname only (no query), e.g. `/roadmap`. One value per browser, not per project.
  - Written by the `(app)` layout on every pathname change, except `/welcome` and `/setup`.
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
- Build the allow-list from the known routes (board, roadmap, docs, graph, chat, memory, activity, manual-tests, explorer, settings, getting-started); `/welcome` and `/setup` never count.
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
- [ ] S3 — WHEN VibeDoc opens a project that already has tasks or a roadmap → THEN it opens the board (or the last page used), not the welcome
