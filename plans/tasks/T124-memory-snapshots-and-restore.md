# T124: Snapshot MEMORY.md before each write + restore
**Status:** 📋 Todo
**Phase:** R045 — Safe memory updates
**Size:** M (2–3 hrs)
**Depends on:** T123

## Goal
Every write to MEMORY.md first saves the version it replaces, so you can bring back the version from before a bad handoff. This covers the epic's second Done-when; T125 and T126 build on it.

## Context
- Epic: `plans/roadmap/R045-safe-memory-updates.md`
- Decided: snapshots are files, not git. They go in `.vibedoc/memory-history/<stamp>.md`, and only the newest 20 are kept. Git only knows committed versions, and handoffs usually sit uncommitted between commits.
- Restore is undoable: before writing the old version back, it snapshots the current file like any other write.
- Project rules: only `src/lib/core.ts` touches fs; `emitUpdate()` is called from API routes only. CLAUDE.md lists every file VibeDoc writes, so add this folder to that list.

## Scope
- [ ] In `core.ts`, a `snapshotMemory(root, actor, reason)` helper:
  - [ ] Copies the current MEMORY.md, when one exists, to `.vibedoc/memory-history/<YYYYMMDDTHHMMSSmmmZ>-<actor>.md`.
  - [ ] Prepends a one-line HTML comment header: `<!-- vibedoc-snapshot actor=ai reason=update -->`.
  - [ ] Prunes to the 20 newest.
- [ ] Call `snapshotMemory` from `updateMemory()` before every write.
- [ ] `listMemoryVersions(root)` → `{ id, at, actor, reason, bytes, excerpt }[]`, newest first. `excerpt` is the first line of that version's handoff section.
- [ ] `getMemoryVersion(id, root)` → the content without the header line.
- [ ] `restoreMemoryVersion(id, root, actor)`:
  - [ ] Validates the id with `/^\d{8}T\d{9}Z-[\w:-]+$/`, so no path traversal.
  - [ ] Snapshots the current file with `reason=restore`, then writes the old content.
  - [ ] Appends a `memory_updated` activity entry, "Restored MEMORY.md from <at>".
- [ ] Routes:
  - [ ] `GET /api/memory/versions` → the list; `?id=` → `{ content }`.
  - [ ] `POST /api/memory/restore {id}` → `{ ok, restoredFrom }` and `emitUpdate('memory_updated')`.
  - [ ] Unknown or invalid id → 404 / 400.
- [ ] Add `/.vibedoc/memory-history/` to `.gitignore`, next to `/.vibedoc/episodes/`.
- [ ] Add the folder to CLAUDE.md's "VibeDoc writes only …" list.

**Out of scope:** the MCP tool (T125), the UI (T126), snapshotting hand edits made outside VibeDoc (we only see our own writes).

## Files
- `src/lib/core.ts`: the Memory section next to `updateMemory()`
- `src/app/api/memory/versions/route.ts`, `src/app/api/memory/restore/route.ts`: new; follow `src/app/api/memory/history/route.ts` (`rootOf`, `errorResponse`, `RoadmapError` for status codes)
- `.gitignore`, `CLAUDE.md`

## Implementation notes
- Use millisecond timestamps so two writes in the same second don't collide. Sorting the filenames as strings sorts them by time.
- Restore bumps the mtime of MEMORY.md. `episodesSinceHandoff` then treats it as a fresh handoff, which is fine because a person chose that version.
- Put the snapshot write inside the same function as the write; the existing code has no lock, so don't add one. Add a `ponytail:` comment saying two concurrent writes can both snapshot the same base.

## Acceptance criteria
- [ ] Three `vibedoc_update_memory` calls → 3 snapshot files. The newest snapshot equals the file as it was before the third call.
- [ ] A 21st write leaves 20 files, and the oldest is gone.
- [ ] `POST /api/memory/restore {id}` makes MEMORY.md equal that version, and also creates a `reason=restore` snapshot of the file that was replaced.
- [ ] `POST /api/memory/restore {id:"../../etc/passwd"}` → 400; nothing is read or written.
- [ ] No MEMORY.md yet → the first write creates no snapshot and no error.

## Verify
```bash
pnpm lint && pnpm build
curl -s 'localhost:3000/api/memory/versions' | head -c 400
curl -s -XPOST localhost:3000/api/memory/restore -H 'content-type: application/json' -d '{"id":"<id from list>"}'
ls .vibedoc/memory-history | wc -l
```
