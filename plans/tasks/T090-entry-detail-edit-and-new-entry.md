# T090: Entry detail, edit and New entry
**Status:** ✅ Done
**Phase:** R047 — Memory browser
**Size:** M (2–3 hrs)
**Depends on:** T089
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
Clicking an entry opens it on the right: its type, summary, body and date. The user can correct any of them, or add a new entry, and the next agent session sees the change. `/memory?entry=E012` opens that entry directly.

## Context
- Epic: `plans/roadmap/R047-memory-browser.md`
- T089 added `GET /api/memory/entries`, `EntryList` and `filterEntries()`.
- Writes go through `saveEntry(input, root, actor)` in `core.ts` (R046): no id = create, id = update. It validates (`validateEntryInput`) and throws with a clear message. A new summary renames the file and keeps the id.
- R053 builds on this view: T071 adds `EntryRelated` under the body, and T072 adds `EntryHistory` under that. Leave a clear spot for them (a wrapper with the body, then the panels).
- Project rules: only `core.ts` touches the file system. Call `emitUpdate()` in the route after a mutation. Show `error` from the JSON response, not a raw fetch message.

## Scope
- [ ] `src/app/api/memory/entries/save/route.ts` (new): `POST { id?, type, summary, body }` → `saveEntry(…, 'human')`, `emitUpdate('memory_updated', { root, entryId })`, returns `{ entry }`
- [ ] `src/components/memory/EntryDetail.tsx` (new): read view with an Edit button, and an edit form (type select, summary input, body textarea, Save, Cancel)
- [ ] "New entry" button above the list: opens the same form, empty
- [ ] Selection in the URL: `?entry=E012`, written with `router.replace`, read on load like `/board?task=`

**Out of scope:** delete (T091). The "changed by" chip (T092). A rich markdown editor: a plain textarea plus the `MarkdownRenderer` preview in read mode is enough.

## Files
- `src/app/api/memory/entries/save/route.ts`: new. Copy the shape of `src/app/api/tasks/restore/route.ts` (`jsonBody`, `rootOf`, `errorResponse` from `../../roadmap/_shared`)
- `src/components/memory/EntryDetail.tsx`: new
- `src/components/memory/MemoryTab.tsx`, `src/components/memory/EntryList.tsx`: selection, New entry button
- `src/app/(app)/memory/page.tsx`: the `?entry=` param. Wrap in `<Suspense>` for `useSearchParams`, like `src/app/(app)/board/page.tsx`

## Implementation notes
- Header: reuse `ItemPanelHeader` (`src/components/shared/ItemPanelHeader.tsx`), with kicker = the entry id and properties Type and Updated. T092 adds a "Changed by" property there.
- The `?entry=` param pattern is at `src/app/(app)/board/page.tsx:23-28`: adjust during render, so a new link re-opens the entry.
- Validation errors come back from `errorResponse` as `{ error }` with status 400. Show the message under the form and keep the user's input.
- After a save, select the saved entry by its returned `id`. A create returns the new id, and a rename keeps the same id.
- An unknown `?entry=` id shows "Entry E999 not found" in the right pane, not a crash.
- Keyboard: Esc cancels the edit. ⌘/Ctrl+Enter saves.

## Acceptance criteria
- [ ] Clicking a row opens the entry. The URL becomes `/memory?entry=E00N`, and reloading keeps it open
- [ ] Editing the summary and saving updates the file (renamed to the new slug), the list and the detail. The next `vibedoc_read_memory` shows the new summary
- [ ] New entry → fill in type, summary and body → Save creates the next `E` id and selects it
- [ ] An empty or multi-line summary shows the server's message, and nothing is written
- [ ] `/memory?entry=E999` shows "not found"

## Verify
```bash
pnpm typecheck && pnpm build && pnpm lint   # no new lint errors beyond the 14 pre-existing ones
curl -s -X POST 'localhost:3000/api/memory/entries/save' -H 'content-type: application/json' \
  -d '{"type":"convention","summary":"Tailwind only","body":"No CSS-in-JS."}'
curl -s -X POST 'localhost:3000/api/memory/entries/save' -H 'content-type: application/json' \
  -d '{"type":"rule","summary":"x"}'   # 400 with the list of valid types
# pnpm dev → /memory → open an entry → Edit → change the summary → Save → the list updates → New entry
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Open /memory and click an entry → it opens on the right with its type, updated date, file and details, and the URL becomes /memory?entry=E00N; reload → it is still open
- [ ] Click Edit, change the summary and type, Save → the list and the detail show the new text at once; memory/entries has the file under the new name with the same id
- [ ] After that edit, start an agent session (vibedoc_read_memory) → the index shows the fixed summary
- [ ] Click New entry, fill it in, press ⌘↵ (Ctrl+Enter) → it gets the next E id and opens
- [ ] Clear the summary and Save → "summary is required" under the form, nothing saved; Esc returns to the read view
- [ ] Open /memory?entry=E999 → "Entry E999 not found" with a link back to the handoff; the ✕ on an open entry also returns to the handoff
### Regression risk
- [ ] On a phone-width window, open an entry from the top of a long list → check whether you have to scroll down to see it (it renders below the list)
