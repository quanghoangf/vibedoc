# T271: Welcome — agent status, Connect slot, "Write project docs"
**Status:** 📋 Todo
**Phase:** R082 — Smart first screen
**Size:** S (~1 hr)
**Depends on:** T270
**Covers:** S4

## Goal
The welcome tells the user whether an agent is connected and hosts the place where R081's Connect panel goes, and the template wizard is reachable only as an optional "Write project docs" action.

## Context
- Epic: `plans/roadmap/R082-smart-first-screen.md`
- Decisions from the breakdown:
  - "Agent connected" = the activity log has a `session_start` event (written by `logSessionStart()` in core when an agent calls `vibedoc_read_memory`). Read through `GET /api/activity`; nothing new stored.
  - **Seam for R081:** a small `ConnectSlot` component (`src/components/welcome/ConnectSlot.tsx`) rendered on the welcome. Until R081 lands it shows "Agent connected ✓" or a one-line "Connect your agent" hint linking `/getting-started`. R081 replaces its body with the Connect panel; note this in the component's comment.
  - "Write project docs" is a secondary action on both welcome variants → `/setup` (keeping `rootParam`). Nothing else opens the wizard.
- CLAUDE.md: UI text in `src/i18n/welcome.ts` (en + vi).

## Scope
- [ ] `ConnectSlot` with connected / not-connected states
- [ ] "Write project docs" secondary action on the welcome → `/setup`
- [ ] Extend `e2e/first-screen.mjs`: clicking "Write project docs" opens the wizard; with a `session_start` event in the fixture's `.vibedoc-activity.json` the slot says connected

**Out of scope:** The Connect panel itself, one-click connect, live ✓ (R081); changing the wizard (epic out of scope).

## Files
- `src/components/welcome/ConnectSlot.tsx` — new
- `src/app/(app)/start/page.tsx`
- `src/i18n/welcome.ts`
- `e2e/first-screen.mjs`

## Implementation notes
- Activity event shape: `ActivityEvent` in core.ts (`type: 'session_start'`); `.vibedoc-activity.json` is a JSON array.
- Refresh the slot on the SSE `session_start` event if AppContext already exposes activity (check `useApp().activity`) — if it does, read from there instead of fetching.

## Acceptance criteria
- [ ] Welcome shows "Agent connected" when the log has a `session_start`, the Connect hint otherwise
- [ ] "Write project docs" opens the template wizard; the wizard opens nowhere else on first run
- [ ] `e2e/first-screen.mjs` and `e2e/i18n.mjs` pass

## Verify
```bash
pnpm build && pnpm lint
BASE=http://localhost:3082 PW_DIR=. node e2e/first-screen.mjs
BASE=http://localhost:3082 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
- [ ] S4 — WHEN the user picks "Write project docs" → THEN the template wizard opens
