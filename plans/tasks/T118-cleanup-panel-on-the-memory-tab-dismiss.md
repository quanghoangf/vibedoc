# T118: Cleanup panel on the Memory tab + dismiss
**Status:** ✅ Done
**Phase:** R051 — Memory cleanup & staleness
**Size:** M
**Depends on:** T117
**Done:** 2026-10-03

## Goal
The Memory tab has a Cleanup panel listing every memory health flag, grouped by kind, with a count badge. A person can dismiss a flag they've judged fine, and it stays dismissed. Later tasks add duplicate and stale flags to this panel.

## Context
- Epic: `plans/roadmap/R051-memory-cleanup-and-staleness.md`
- `getMemoryHealth(root)` and `HealthFlag` exist in `src/lib/memory-health.ts` / `core.ts` (previous task).
- Decided: dismissals are stored in a sidecar `memory/.cleanup.json` (`{ "dismissed": { "<flag id>": "YYYY-MM-DD" } }`), not in the entry files. A dismissed flag stays hidden while its id stays the same. A new contradiction gets a new id and shows again.
- Decided: dismissed flags are hidden from `vibedoc_read_memory` too.
- Project rules: only `core.ts` touches the file system. Call `emitUpdate()` in the route after a mutation, never from `core.ts`.

## Scope
- [x] `core.ts`: `readCleanupState(root)`, `dismissHealthFlag(flagId, root, actor)`. `getMemoryHealth` filters out dismissed ids (with an `includeDismissed` option for the panel's "show dismissed" toggle)
- [x] `src/app/api/memory/health/route.ts` (new): `GET` returns `{ flags }`
- [x] `src/app/api/memory/health/dismiss/route.ts` (new): `POST { id }`
- [x] `src/components/memory/CleanupPanel.tsx` (new): grouped list, each row with a message, links to the referenced items (open the task, epic or entry the way the Related panel from T071 does), and a Dismiss button
- [x] A "Cleanup (N)" entry point on `/memory` next to the entry list. It refreshes on the `memory_updated` and task/roadmap SSE events

**Out of scope:** duplicate flags and merge (the next two tasks), stale flags (the recall-log task), undoing a dismiss (the "show dismissed" toggle is enough).

## Files
- `src/lib/core.ts`, `src/app/api/memory/health/route.ts`, `src/app/api/memory/health/dismiss/route.ts`: as above
- `src/components/memory/CleanupPanel.tsx`: new
- the `/memory` page component that hosts the entry list (R047 T089): mount the panel

## Implementation notes
- Write `.cleanup.json` with sorted keys and a trailing newline so the git diffs stay small. A missing or invalid file means an empty state, not an error.
- Copy the fetch-and-refresh-on-SSE pattern the entry list already uses (T089).
- Activity: reuse `memory_updated`, title `Cleanup flag dismissed`, detail = the flag message.
- An empty panel says "Memory looks clean".

## Acceptance criteria
- [x] With a done task under Working on, `/memory` shows "Cleanup (1)" and the contradiction row links to the task
- [x] Dismiss hides the row, writes `memory/.cleanup.json`, and the warning disappears from `vibedoc_read_memory`
- [x] Changing the task's status on the board updates the panel live, without a reload
- [x] "Show dismissed" lists dismissed flags greyed out

## Verify
```bash
pnpm typecheck && pnpm build && pnpm lint
curl -s localhost:3000/api/memory/health
# pnpm dev → /memory → Cleanup → Dismiss → reload: still hidden
```

## Manual tests
_2026-10-03 — ai_
### Steps
- [x] Put a done task id under `## Working on now` in `memory/MEMORY.md`, open `/memory` → header shows "Cleanup (1)" with an amber warning icon
- [x] Click Cleanup → right pane lists the flag under "Contradicts the board"; click the task id in the row → `/board?task=<id>` opens that task
- [x] Back on `/memory?cleanup=1`, click Dismiss → row disappears, "Memory looks clean", `memory/.cleanup.json` holds the flag id with today's date
- [x] Reload the page → flag still hidden; call `vibedoc_read_memory` → no "Memory warnings" line for that task
- [x] With the panel open in one tab, move another task named under Working on to Done on `/board` in a second tab → its row appears in the first tab without a reload
- [x] Tick "Show dismissed" → the dismissed flag shows greyed out with "dismissed YYYY-MM-DD" and no Dismiss button
### Regression risk
- [x] Memory tab List/Graph toggle, opening an entry and New entry still work; opening an entry closes the Cleanup panel
- [x] Session start (`vibedoc_read_memory`) still shows warnings for flags that are not dismissed
