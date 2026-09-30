# T091: Delete an entry with Undo
**Status:** 📋 Todo
**Phase:** R047 — Memory browser
**Size:** S (~1 hr)
**Depends on:** T090

## Goal
A user removes a wrong entry from the Memory tab in one click, and can undo it for a few seconds. This works the same as deleting a task or a doc.

## Context
- Epic: `plans/roadmap/R047-memory-browser.md`
- `deleteEntry(id, root, actor)` exists in `core.ts` (R046). It removes the file and returns the deleted `Entry`.
- Decided: no confirm dialog. Use `undoToast()` (`src/components/ui/toast.tsx`) plus a restore endpoint, the same as R054's task and roadmap deletes.
- Project rules: only `core.ts` touches the file system. Call `emitUpdate()` after a mutation.

## Scope
- [ ] `core.ts`: `restoreEntry(file, raw, root, actor)`. It writes the file back only if it is a plain `memory/entries/E<n>-*.md` path and that id does not exist now
- [ ] `src/app/api/memory/entries/delete/route.ts` (new): `POST { id }` → `deleteEntry`, returns `{ file, raw }` so the client can undo
- [ ] `src/app/api/memory/entries/restore/route.ts` (new): `POST { file, raw }` → `restoreEntry`
- [ ] A Delete action in `EntryDetail` (and ⌫ while an entry is open and focus is not in a text field)

**Out of scope:** bulk delete. A trash or history view (R053 T072 shows history from git).

## Files
- `src/lib/core.ts`: add `restoreEntry()` next to `deleteEntry()`. Make `deleteEntry` also return the raw file text (read it before `fs.rm`), or add the text in the route through a core function. Don't use `fs` in the route
- `src/app/api/memory/entries/delete/route.ts`, `src/app/api/memory/entries/restore/route.ts`: new. Copy `src/app/api/tasks/restore/route.ts`
- `src/components/memory/EntryDetail.tsx`: the Delete button

## Implementation notes
- Copy the guard in `restoreTask()` (`src/lib/core.ts`, `isFileIn(file, 'plans/tasks', /^T\d+[^/]*\.md$/)`, then write with `flag: 'wx'`). Here: `isFileIn(file, 'memory/entries', /^E\d+[^/]*\.md$/)`. Refuse if `getEntry(id)` finds the id, because the next save can reuse the highest id.
- Run `restoreEntry` under `withEntryLock`, so a save in parallel cannot take the id.
- Both routes call `emitUpdate('memory_updated', { root, entryId })`. Activity: the delete already logs `Entry E00N deleted`. The restore logs `Entry E00N restored`.
- After a delete, close the detail and drop `?entry=` from the URL. Undo re-opens the entry.

## Acceptance criteria
- [ ] Delete removes the file and the row, and shows a toast "Deleted E00N" with Undo
- [ ] Undo within the toast time brings the same file back (same id, same text), and the entry reopens
- [ ] Restore refuses a path outside `memory/entries/`, a non-entry file name, or an id that exists now (400)
- [ ] The next `vibedoc_read_memory` no longer lists a deleted entry

## Verify
```bash
pnpm typecheck && pnpm build && pnpm lint   # no new lint errors beyond the 14 pre-existing ones
curl -s -X POST 'localhost:3000/api/memory/entries/delete' -H 'content-type: application/json' -d '{"id":"E001"}'
curl -s -X POST 'localhost:3000/api/memory/entries/restore' -H 'content-type: application/json' \
  -d '{"file":"../../etc/passwd","raw":"x"}'   # 400
# pnpm dev → /memory → open an entry → Delete → Undo → it is back
```
