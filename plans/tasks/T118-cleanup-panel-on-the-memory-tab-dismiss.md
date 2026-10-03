# T118: Cleanup panel on the Memory tab + dismiss
**Status:** 📋 Ready
**Phase:** R051 — Memory cleanup & staleness
**Size:** M
**Depends on:** T117

## Goal
The Memory tab has a Cleanup panel listing every memory health flag, grouped by kind, with a count badge. A person can dismiss a flag they've judged fine, and it stays dismissed. Later tasks add duplicate and stale flags to this panel.

## Context
- Epic: `plans/roadmap/R051-memory-cleanup-and-staleness.md`
- `getMemoryHealth(root)` and `HealthFlag` exist in `src/lib/memory-health.ts` / `core.ts` (previous task).
- Decided: dismissals are stored in a sidecar `memory/.cleanup.json` (`{ "dismissed": { "<flag id>": "YYYY-MM-DD" } }`), not in the entry files. A dismissed flag stays hidden while its id stays the same. A new contradiction gets a new id and shows again.
- Decided: dismissed flags are hidden from `vibedoc_read_memory` too.
- Project rules: only `core.ts` touches the file system. Call `emitUpdate()` in the route after a mutation, never from `core.ts`.

## Scope
- [ ] `core.ts`: `readCleanupState(root)`, `dismissHealthFlag(flagId, root, actor)`. `getMemoryHealth` filters out dismissed ids (with an `includeDismissed` option for the panel's "show dismissed" toggle)
- [ ] `src/app/api/memory/health/route.ts` (new): `GET` returns `{ flags }`
- [ ] `src/app/api/memory/health/dismiss/route.ts` (new): `POST { id }`
- [ ] `src/components/memory/CleanupPanel.tsx` (new): grouped list, each row with a message, links to the referenced items (open the task, epic or entry the way the Related panel from T071 does), and a Dismiss button
- [ ] A "Cleanup (N)" entry point on `/memory` next to the entry list. It refreshes on the `memory_updated` and task/roadmap SSE events

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
- [ ] With a done task under Working on, `/memory` shows "Cleanup (1)" and the contradiction row links to the task
- [ ] Dismiss hides the row, writes `memory/.cleanup.json`, and the warning disappears from `vibedoc_read_memory`
- [ ] Changing the task's status on the board updates the panel live, without a reload
- [ ] "Show dismissed" lists dismissed flags greyed out

## Verify
```bash
pnpm typecheck && pnpm build && pnpm lint
curl -s localhost:3000/api/memory/health
# pnpm dev → /memory → Cleanup → Dismiss → reload: still hidden
```
