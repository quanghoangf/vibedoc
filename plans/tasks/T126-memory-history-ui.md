# T126: Version history + diff + Restore on /memory
**Status:** ✅ Done
**Done:** 2026-10-03
**Phase:** R045 — Safe memory updates
**Size:** M (2–3 hrs)
**Depends on:** T124

## Goal
On `/memory`, a person sees the earlier versions of the handoff: when each was saved, who saved it, and what changed. They can restore one in a click, and Undo puts the newer version back.

## Context
- Epic: `plans/roadmap/R045-safe-memory-updates.md`
- APIs from T124: `GET /api/memory/versions`, `?id=` and `POST /api/memory/restore`.
- The handoff pane lives in `src/components/memory/MemoryTab.tsx` (the last branch: the "Session handoff" header and `MarkdownRenderer`).
- Reuse, don't rebuild:
  - `lineDiff()` in `src/lib/diff.ts`, the same diff the chat's propose-edit card shows.
  - `undoToast()` in `src/components/ui/toast.tsx`.
  - `OwnerChip`, for who saved each version.
  - `EntryHistory.tsx`, the closest existing "history list + view a version" UI (R053); match its look.
- DESIGN.md "Lab Notebook" rules: tokens only, ids and timestamps in mono, and status language as in the rest of the memory page.
- Never use `localStorage`. URL state follows `?entry=` (e.g. `?history=1`, `?version=<id>`).

## Scope
- [x] A "History (N)" button in the handoff header; `?history=1` opens the list in place of the rendered handoff.
- [x] Each row: relative time (absolute in the `title`), `OwnerChip` for the actor, reason (update / restore) and the handoff excerpt.
- [x] Selecting a row (`?version=`) shows a line diff of that version against the current file, with a "Restore this version" button.
- [x] Restore → `POST /api/memory/restore`, then `undoToast("Restored MEMORY.md", …)`. Undo restores the `reason=restore` snapshot the call just created, so the API should return its id.
- [x] Refresh live when a `memory_updated` SSE event arrives (an agent writes while the list is open).
- [x] Empty state: "No earlier versions yet. VibeDoc saves one before each handoff."

**Out of scope:** editing MEMORY.md in the UI; snapshots of edits made outside VibeDoc.

## Files
- `src/components/memory/MemoryHistory.tsx`: new
- `src/components/memory/MemoryTab.tsx`: header button and the branch to the history pane
- `src/app/api/memory/restore/route.ts`: return `{ ok, restoredFrom, replacedId }` if T124 didn't already

## Acceptance criteria
- [x] After two agent handoffs, History lists 2 versions newest first, and the diff marks the changed handoff lines in +/−.
- [x] Restore puts the old handoff back in the rendered view without a reload; Undo brings the newer one back.
- [x] Keyboard: rows are buttons and can be reached with Tab; Esc closes the history pane.
- [x] Works at 390px wide with no horizontal scroll, in dark and light.
- [x] No new lint errors above the current baseline.

## Verify
```bash
pnpm lint && pnpm build
# open http://localhost:3000/memory?history=1
```
