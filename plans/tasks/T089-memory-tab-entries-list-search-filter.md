# T089: Entries on /memory — API + list, search and type filter
**Status:** ✅ Done
**Phase:** R047 — Memory browser
**Size:** M (2–3 hrs)
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
The Memory tab shows every knowledge entry next to the handoff. A user can type a word and see the matching entries, ranked the way agents see them in `vibedoc_recall`, and narrow the list by type. This is the thin read-only slice of the epic. Later tasks add the detail view, editing and delete.

## Context
- Epic: `plans/roadmap/R047-memory-browser.md`
- Entries shipped in R046/R048: `listEntries(root)` in `src/lib/core.ts` returns `Entry = { id, type, summary, body, updatedAt, file }` (`src/lib/entries.ts`). `rankEntries(entries, query, { type, limit })` in `src/lib/recall.ts` is pure and runs in the browser too.
- Decided: search ranks with `rankEntries`, so the UI and `vibedoc_recall` agree. With an empty query, the list is sorted newest first (`indexHits()` order in `recall.ts`).
- Decided: layout is two panes on `/memory`: the list on the left, the detail on the right (T090). This task renders only the list plus the existing handoff card.
- Project rules (CLAUDE.md): only `core.ts` touches the file system. Tailwind only. No `localStorage`. The Memory page is a client component that fetches from our own API routes.

## Scope
- [ ] `src/app/api/memory/entries/route.ts` (new): `GET` returns `{ entries: Entry[] }` for `?root=`
- [ ] `src/lib/memory-view.ts` (new, pure): `filterEntries(entries, { query, type })` → the list to show
- [ ] `src/lib/memory-view.check.mts` (new): assert-based self-check
- [ ] `src/components/memory/EntryList.tsx` (new): search box, type chips, one row per entry
- [ ] `src/components/memory/MemoryTab.tsx` / `src/app/(app)/memory/page.tsx`: fetch the entries, render the list beside the handoff, refetch on the `memory_updated` SSE event

**Out of scope:** opening, editing or adding an entry (T090). Delete (T091). The "changed by" chip (T092). Graph and Related panels (R053).

## Files
- `src/app/api/memory/entries/route.ts`: new. Read the root with `rootOf(req)` from `src/app/api/roadmap/_shared.ts`, like `src/app/api/tasks/restore/route.ts`
- `src/lib/memory-view.ts`, `src/lib/memory-view.check.mts`: new
- `src/components/memory/EntryList.tsx`: new
- `src/components/memory/MemoryTab.tsx`: now takes the entries too. The file uses CRLF line endings, so keep them
- `src/app/(app)/memory/page.tsx`: fetch `/api/memory/entries${rootParam}` from `useApp()`

## Implementation notes
- `filterEntries`: when `tokenize(query)` is empty, return the entries of the chosen type, newest first. Otherwise return `rankEntries(entries, query, { type, limit: entries.length })` mapped back to the full entries. Pin this signature, because T090 selects rows from its output:
  ```ts
  export function filterEntries(entries: Entry[], opts: { query?: string; type?: EntryType | null }): Entry[]
  ```
- Type chips: "All" plus one chip per `ENTRY_TYPES` value, each with its count.
- A row shows the id (mono, muted), the type, the summary, and the `updatedAt` date. The whole row is a `<button>` (T090 makes it open the entry).
- The page already refreshes on SSE: `AppContext` refreshes on `memory_updated` (`src/context/AppContext.tsx:134`). Refetch the entries at the same moment. The simplest way is an effect keyed on `summary`, because `refresh()` replaces it.
- Keep the handoff card and the "Add to your CLAUDE.md" hint. On a narrow screen the panes stack.
- Empty states: no entries → "No knowledge entries yet. Agents save them with vibedoc_save_entry." A search with no hits → "No entries match …".

## Acceptance criteria
- [ ] `GET /api/memory/entries` returns every entry, and `[]` when `memory/entries/` does not exist
- [ ] `/memory` lists all entries next to the handoff, newest first
- [ ] Typing `sse events` puts the SSE entry first. Clearing the box restores the full list
- [ ] Clicking the `gotcha` chip shows only gotchas, and the chip counts are right
- [ ] When an agent saves an entry through MCP, the list updates without a reload
- [ ] `memory-view.check.mts` covers: empty query order, type filter, ranked query, query plus type, no hits

## Implementation note (done)
`filterEntries` lives in `src/lib/recall.ts` (self-check `recall.check.mts`), not in a new `memory-view.ts`: the pure libs don't import values from each other, because `node *.check.mts` runs them without a bundler.

## Verify
```bash
node src/lib/memory-view.check.mts
pnpm typecheck && pnpm build && pnpm lint   # no new lint errors beyond the 14 pre-existing ones
curl -s 'localhost:3000/api/memory/entries' | head -c 300
# pnpm dev → /memory → search "sse" → type chips → save an entry via MCP → the list updates live
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Open /memory in a project with a few knowledge entries → a "Knowledge entries" list on the left and the session handoff on the right, the list newest first
- [ ] Type "sse events" in the search box → the SSE entry is first (the same order vibedoc_recall gives); clear it → the full list is back
- [ ] Click the "gotcha" chip → only gotchas; each chip shows the right count
- [ ] Type a word no entry has → "No entries match …"
- [ ] Keep /memory open and have an agent call vibedoc_save_entry → the new entry appears without a reload
- [ ] Open /memory in a project with no memory/entries folder → "No knowledge entries yet…" and the handoff still shows
### Regression risk
- [ ] On a phone-width window the list stacks above the handoff and nothing scrolls sideways
