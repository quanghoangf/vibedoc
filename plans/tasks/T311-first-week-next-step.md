# T311: Next step is one click: each item's page or command
**Status:** ✅ Done
**Owner:** ai:claude
**Phase:** R084 — First-week checklist
**Size:** M (2–3 hrs)
**Depends on:** T310
**Covers:** S2
**Started:** 2026-10-07
**Done:** 2026-10-07

## Goal
Every checklist item links to the page where it happens or gives the exact command to copy, and the first unticked item is open with that action ready, so the next step is one click.

## Context
- Epic: `plans/roadmap/R084-first-week-checklist.md`
- Builds on T310 (`src/lib/first-week.ts`, `getFirstWeek()`, `FirstWeek.tsx`).
- Actions per step (decided in the breakdown):
  - `agent` → copy `claude mcp add --transport http vibedoc <origin>/api/mcp` (same string as `ConnectMenu` in `AppHeader.tsx`, `useOrigin()`), plus a link to `/settings`. Seam: R081 builds the real Connect panel and R080 the stable address; when they land, this row should point at them. Note this in a comment.
  - `roadmap` → link `/roadmap` (it has "Generate roadmap") and copy `/vibedoc:roadmap`
  - `breakdown` → copy `/vibedoc:breakdown <first epic without tasks>` (just `/vibedoc:breakdown` when none)
  - `taskDone` → copy `/vibedoc:work <first epic with tasks>`
  - `testRun` → link `/manual-tests`
  - `memory` → link `/memory`
- The command strings are built in the pure lib (`stepAction(id, ctx)`), so the check covers them.
- CLAUDE.md i18n rule applies; commands themselves stay untranslated.

## Scope
- [ ] `stepAction()` in `src/lib/first-week.ts` (+ check cases)
- [ ] `FirstWeek.tsx`: the first unticked item is expanded with one sentence on why it matters, its link and/or a copy button (✓ on copy, like `ConnectMenu`); other unticked items expand on click; ticked items stay collapsed
- [ ] Extend `e2e/first-week.mjs`: on a fresh project the first unticked item shows the `claude mcp add` command with this server's `/api/mcp`, and its copy button copies it; after the roadmap tick the open item shows `/vibedoc:breakdown R…` with the real epic id

**Out of scope:** running commands for the user (R081), dismiss (T312).

## Files
- `src/lib/first-week.ts`, `src/lib/first-week.check.mts`
- `src/components/layout/FirstWeek.tsx`
- `src/i18n/firstWeek.ts`
- `e2e/first-week.mjs`

## Acceptance criteria
- [ ] Opening the checklist shows the first unticked item with its page link or exact command, one click to copy (S2)
- [ ] Commands carry the project's real epic ids and this server's MCP URL
- [ ] Keyboard: every link and copy button is reachable with Tab and has an accessible name

## Verify
```bash
node src/lib/first-week.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3084 PW_DIR=<dir with node_modules/playwright> node e2e/first-week.mjs
```

## Manual tests
_2026-10-07 — ai:claude_
### Steps
- [x] S2 — WHEN the user opens the checklist → THEN the first unticked item shows its page or the exact command to copy
- [ ] On a fresh project, click the copy icon on the `claude mcp add` line, paste it in a terminal → it adds VibeDoc to Claude Code with this server's URL
- [ ] Click a later unticked step → it opens and the previous one closes; click it again → it closes
- [ ] Tab through the checklist → every step, copy button and Open link gets a visible focus ring
### Regression risk
- [ ] The header's Connect menu still copies the same `claude mcp add` line
