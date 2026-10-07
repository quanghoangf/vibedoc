# T310: First-week checklist derived from the project, live in the sidebar
**Status:** ✅ Done
**Owner:** ai:claude
**Phase:** R084 — First-week checklist
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1
**Started:** 2026-10-07
**Done:** 2026-10-07

## Goal
A "First week" section in the left sidebar lists the six steps of the VibeDoc loop and ticks each one from what is on disk, live over SSE, so a user sees "First task done" tick the moment the agent finishes their first task.

## Context
- Epic: `plans/roadmap/R084-first-week-checklist.md`
- Decisions from the breakdown: ticks are **derived** on every read from the project's files, never stored and never ticked by hand. The six steps and their facts:
  1. `agent` — agent connected: any activity event with `actor: 'ai'` (same rule as the header's "last agent call", `ConnectMenu` in `src/components/layout/AppHeader.tsx`). R081 (Connect your agent) may later bring a better signal; keep the fact behind one function (`agentConnected` in core) so R081 can swap it — note this seam in the code with a comment.
  2. `roadmap` — roadmap created: at least one roadmap item exists (`listRoadmap`/the function the roadmap API uses).
  3. `breakdown` — first epic broken down: an epic (item with a parent) has a non-empty `tasks` list.
  4. `taskDone` — first task done by the agent: a task in `done` whose `owner` starts with `ai:` (an agent becomes owner when it moves the task to in-progress, `ownerAfterMove` in core.ts), or whose move to done was an `ai` `task_updated` event (a direct todo → done by an agent leaves the owner empty).
  5. `testRun` — first test run with evidence: a task with `lastRun` set.
  6. `memory` — first memory entry: `listEntries(root)` is non-empty.
- Out of the sidebar in demo mode (`useApp().demo`), like `SidebarChats`.
- CLAUDE.md: "Only `src/lib/core.ts` touches the file system"; "Always call `emitUpdate()` after any mutation in an API route" (this task adds a read route only); "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`) and read it with `useT()`"; "Pure libs never import values from each other" (checks run with `node *.check.mts`).
- Other epics own: the stable address (R080), the Connect panel (R081), the welcome screen (R082). Don't build them.

## Scope
- [ ] Pure `src/lib/first-week.ts`: `FIRST_WEEK_STEPS` (ids in order), `firstWeek(facts) → { steps: {id, done}[], done, total, next }` where `next` is the first unticked id or null; self-check `src/lib/first-week.check.mts`
- [ ] `getFirstWeek(root, tasks)` in `src/lib/core.ts` gathers the facts and returns `firstWeek(facts)` plus the context T311 needs later (first epic id without tasks, first epic with tasks); `getProjectSummary()` returns it as `firstWeek`, reusing the tasks it already lists
- [ ] `/api/summary` therefore carries it: `refresh()` fetches it on SSE and on the auto-refresh poll (`SettingsApplier`, default 10 s), which also catches the terminal skills that write `plans/` without an API call
- [ ] `AppContext` refreshes on `roadmap_updated` too (not `kind: 'layout'`), so a roadmap created in the UI or over MCP ticks at once
- [ ] `src/components/layout/FirstWeek.tsx`: a sidebar group "First week · n/6" with the six labelled rows (✓ / ○), read from `useApp().summary.firstWeek`; rendered in `AppSidebar.tsx` above the nav groups; icon-collapsed sidebar shows only an icon with the count in its tooltip
- [ ] Text in a new `src/i18n/firstWeek.ts` (en + vi), merged in `src/i18n/index.ts`
- [ ] `e2e/first-week.mjs` (port from `BASE`, default `http://localhost:3084`): fresh fixture (`makeFixture` from `e2e/stub-chat.mjs`), open /board, then an agent marks a task done over `/api/mcp` (`vibedoc_update_task`, an `ai` owner) → "First task done" ticks without a reload

**Out of scope:** item links / commands (T311), dismiss and finished state (T312), the docs (T313).

## Files
- `src/lib/first-week.ts`, `src/lib/first-week.check.mts` — new
- `src/lib/core.ts` — `getFirstWeek()`, `agentConnected()`
- `src/context/AppContext.tsx` — refresh on `roadmap_updated`
- `src/components/layout/FirstWeek.tsx` — new
- `src/components/layout/AppSidebar.tsx` — render it
- `src/i18n/firstWeek.ts`, `src/i18n/index.ts`
- `e2e/first-week.mjs` — new

## Implementation notes
- No second fetch or EventSource: the summary already follows SSE and the poll.
- Read the whole activity log (`readActivity(root, ACTIVITY_CAP)`), not the default 50.
- Fetch with `rootParam` from `useApp()`.

## Acceptance criteria
- [ ] On an empty project the sidebar shows "First week 0/6" with six unticked rows
- [ ] When an agent marks a task done over MCP, "First task done" ticks within a second, without a reload (S1)
- [ ] A task a human moves to done (owner `human`) does not tick "First task done"
- [ ] Hidden in demo mode; `node src/lib/first-week.check.mts` passes; both languages have every key (`node src/lib/i18n.check.mts`)

## Verify
```bash
node src/lib/first-week.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
PORT=3084 pnpm dev   # then, in another shell:
BASE=http://localhost:3084 PW_DIR=<dir with node_modules/playwright> node e2e/first-week.mjs
```

## Manual tests
_2026-10-07 — ai:claude_
### Steps
- [x] S1 — WHEN the agent marks the user's first task done → THEN "First task done" ticks without a reload
- [ ] Open a fresh project → the sidebar shows "First week 0/6" under Chats with six unticked rows
- [ ] Collapse the sidebar to icons → one checklist icon whose tooltip reads "First week 0/6"
- [ ] Switch the language to Tiếng Việt → the six rows and the title are in Vietnamese
### Regression risk
- [ ] Dragging a roadmap node doesn't make the board refresh (layout saves are ignored)
