# T120: Approve a merge → one entry (with Undo)
**Status:** 📋 Ready
**Phase:** R051 — Memory cleanup & staleness
**Size:** L
**Depends on:** T119

## Goal
From a duplicate suggestion, a person opens "Merge…", picks the entry to keep, edits the merged type, summary and body, and approves. Afterwards one entry remains and the others are gone, and Undo brings everything back. This covers the epic's second Done-when criterion: "approving a suggested merge leaves one entry".

## Context
- Epic: `plans/roadmap/R051-memory-cleanup-and-staleness.md`
- `saveEntry`, `deleteEntry` (which returns the raw text, T091), `restoreEntry` and `withEntryLock` exist in `core.ts`. The `undoToast()` pattern is in `src/components/ui/toast.tsx`.
- Decided: nothing is merged or deleted without approval. The merge dialog is the approval.
- Project rules: only `core.ts` touches the file system. Call `emitUpdate()` in the route.

## Scope
- [ ] `core.ts`: `mergeEntries({ keepId, dropIds, type, summary, body }, root, actor)` under `withEntryLock`. It updates the kept entry, then deletes the dropped ones. It returns `{ before: { file, raw }[] }` covering the kept entry's old file and every dropped file
- [ ] `core.ts`: `undoMerge(before, root, actor)` restores the kept entry's old text (and file name, if the summary rename changed it) and re-creates the dropped files. Use the same path guard as `restoreEntry`
- [ ] `src/app/api/memory/entries/merge/route.ts` and `.../merge/undo/route.ts` (new)
- [ ] `src/components/memory/MergeDialog.tsx` (new): side-by-side view of the group, a radio for which id to keep (default: the oldest id), and fields for the merged summary and body. The body defaults to the kept body plus the other bodies under `---`
- [ ] Wire the "Merge…" button in the Cleanup panel. After a merge, show a toast "Merged into E004" with Undo, and open the kept entry

**Out of scope:** merging entries the panel didn't suggest (no free-form multi-select in this epic), automatic merges.

## Files
- `src/lib/core.ts`
- `src/app/api/memory/entries/merge/route.ts`, `src/app/api/memory/entries/merge/undo/route.ts`: new. Copy `api/memory/entries/delete/route.ts`
- `src/components/memory/MergeDialog.tsx`: new
- `src/components/memory/CleanupPanel.tsx`

## Implementation notes
- Validate everything (all ids exist, keepId not in dropIds, `validateEntryInput` passes) **before** writing anything, so a bad request leaves no partial merge.
- Rewrite references: other entries' bodies that mention a dropped id get it replaced with the kept id, so the memory graph (T069) doesn't end up with dangling links. Include those files in `before` so Undo reverts them too.
- Activity: one `memory_updated` event, title `Entries merged into E004`, detail `E011 merged`.
- `undoMerge` refuses when a dropped id has been re-created since (400), the same as the `restoreEntry` guard.

## Acceptance criteria
- [ ] Approving a merge of E004 + E011 keeping E004 leaves one file, `E004-*.md`, with the edited text. E011's file is gone and the duplicate flag disappears
- [ ] Another entry that mentioned E011 now mentions E004
- [ ] Undo restores both files and the rewritten entry exactly (same file names, same text)
- [ ] An invalid request (unknown id, empty summary) returns 400, and no file changes
- [ ] The next `vibedoc_read_memory` index lists only E004

## Verify
```bash
pnpm typecheck && pnpm build && pnpm lint
curl -s -X POST localhost:3000/api/memory/entries/merge -H 'content-type: application/json' \
  -d '{"keepId":"E004","dropIds":["E011"],"type":"convention","summary":"Only core.ts touches the file system","body":"…"}'
ls memory/entries
# pnpm dev → /memory → Cleanup → Merge… → Approve → Undo
```
