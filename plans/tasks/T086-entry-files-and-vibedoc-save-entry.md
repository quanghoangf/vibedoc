# T086: Entry files + vibedoc_save_entry
**Status:** ✅ Done
**Phase:** R046 — Project knowledge entries
**Size:** M (2–3 hrs)
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
An agent calls `vibedoc_save_entry { type: "convention", summary: "Only core.ts touches the file system", body: "…" }` and a new file `memory/entries/E001-only-core-ts-touches-the-file-system.md` appears in the project. Calling it again with `id: "E001"` updates that file. This is the thin end-to-end path of the epic: one fact becomes one plain markdown file in git.

## Context
- Epic: `plans/roadmap/R046-project-knowledge-entries.md`
- Decided: entries live in `memory/entries/`, next to `MEMORY.md`, and are committed to git. R053 (T072) reads each entry's history from `git log`, so the files are plain and never hidden.
- Decided: the file format is the same `**Key:** Value` meta block the task files use. There is no YAML frontmatter.
- Decided: the type is a fixed set: `convention`, `gotcha`, `decision`, `preference`. An unknown type is an error that lists the valid ones.
- Decided: ids are `E` plus 3 digits (`E001`), taken as the next number after the highest id on disk. R048 (T065/T066) and R053 (T069) already assume `E\d+` ids.
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches the file system. `/api/mcp` is hand-rolled JSON-RPC, so don't add the MCP SDK. Call `emitUpdate()` after a mutation in the route, never from `core.ts`. Pure logic goes in its own `src/lib/*.ts` with a `*.check.mts` self-check (see `src/lib/work-queue.ts`).

## Scope
- [ ] `src/lib/entries.ts` (new, pure, no fs): the types, `ENTRY_TYPES`, `normalizeEntryId()`, `nextEntryId()`, `entrySlug()`, `parseEntry()`, `formatEntry()`, `validateEntryInput()`
- [ ] `src/lib/entries.check.mts` (new): assert-based self-check
- [ ] `core.ts`: `listEntries(root)`, `getEntry(id, root)` and `saveEntry(input, root, actor)` under a new `// ─── Knowledge entries ───` section after the memory functions
- [ ] `/api/mcp`: register `vibedoc_save_entry` next to `vibedoc_update_memory` and handle it

**Out of scope:** delete and the session-start index (T087). Agent guidance and docs (T088). Fetching full bodies by id (`vibedoc_get_entries`, R048 T066). Ranked search (R048). A UI or REST route for entries (R047).

## Files
- `src/lib/entries.ts`: new
- `src/lib/entries.check.mts`: new
- `src/lib/core.ts`: add the entry functions and an `ENTRIES_DIR` constant
- `src/app/api/mcp/route.ts`: the tool definition after `vibedoc_update_memory` (around line 262) and a `case` after `case "vibedoc_update_memory"` (around line 807)

## Implementation notes
Pin this shape, because T087, R047, R048 and R053 build on it:

```ts
export const ENTRY_TYPES = ['convention', 'gotcha', 'decision', 'preference'] as const
export type EntryType = typeof ENTRY_TYPES[number]
export type Entry = { id: string; type: EntryType; summary: string; body: string; updatedAt: string; file: string }
// updatedAt = the **Updated:** date (YYYY-MM-DD); file = path relative to root, e.g. memory/entries/E001-….md
export type EntryInput = { id?: string; type: string; summary: string; body?: string }

export function normalizeEntryId(s: string): string | null   // "e1" / "E01" / "E001" → "E001"; anything else → null
export function nextEntryId(ids: string[]): string           // [] → "E001"; ["E001","E007"] → "E008"
export function entrySlug(summary: string): string           // lowercase, non-alphanumerics → "-", trimmed, max 40 chars
export function parseEntry(raw: string, file: string): Entry | null   // null when the H1 or **Type:** is missing
export function formatEntry(e: Omit<Entry, 'file'>): string
export function validateEntryInput(i: EntryInput): string | null      // error message, or null when valid
```

File format. The meta block has no blank lines inside it, as with task files:

```md
# E001: Only core.ts touches the file system
**Type:** convention
**Updated:** 2026-09-30

API routes import from core, never `fs`.
```

- The summary is the H1 text after `E001: `. Validation: summary required, one line, at most 120 characters. `body` is optional and defaults to `""`.
- `saveEntry` without an `id` creates an entry. With an `id` it updates that entry, replacing type, summary and body and setting `**Updated:**` to today. An unknown id is an error; don't create it. When the summary changes, rename the file to the new slug (the id stays), so the file name keeps telling a human what's inside.
- Read the date with `new Date().toISOString().slice(0, 10)`, the way `updateMemory()` does.
- New-id allocation must be serialized, because two agents can save at the same moment. Add a `withEntryLock`, a copy of the `withTaskClaimLock` pattern in `core.ts` (around line 652), including its `ponytail:` comment about one process.
- `listEntries` reads `memory/entries/*.md`, skips files that `parseEntry` rejects, and sorts by id. A missing folder returns `[]`, not an error.
- Activity: reuse the existing `memory_updated` event type, with title `Entry E001 saved` and detail = the summary. Don't add a new `ActivityEvent` type. The activity feed already renders `memory_updated`.
- MCP input: `{ id?: string, type: string (enum ENTRY_TYPES), summary: string, body?: string }`, required `["type", "summary"]`. Description: "Save one long-lived fact (convention, gotcha, decision, preference) as its own entry. Omit id to create; pass id to update. Put facts that should outlast this session here, not in the handoff." Reply: `🧠 Saved **E001** · convention · <summary>` with `memory/entries/<file>` on the next line. A validation error goes back as a tool error with the message. After a save, the route calls `emitUpdate("memory_updated", { root, entryId })`.

## Acceptance criteria
- [ ] `vibedoc_save_entry` without an id creates `memory/entries/E001-<slug>.md` in the exact format above
- [ ] A second call without an id creates `E002`. Calling with `id: "e1"` updates E001's type, summary and body, bumps `**Updated:**`, and renames the file when the summary changed
- [ ] An unknown type, an empty or multi-line summary, or an unknown id returns a clear error, and no file is written
- [ ] `listEntries()` returns `[]` when `memory/entries/` doesn't exist
- [ ] `entries.check.mts` covers: id normalization, next id with gaps, slugging, a parse → format round trip, parse rejecting a file without the H1 or type, and every validation error

## Verify
```bash
node src/lib/entries.check.mts
pnpm build && pnpm lint   # no new lint errors beyond the 16 pre-existing react-hooks ones
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_save_entry","arguments":{"type":"convention","summary":"Only core.ts touches the file system","body":"API routes import from core."}}}'
ls memory/entries && cat memory/entries/E001-*.md
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_save_entry","arguments":{"type":"rule","summary":"x"}}}'   # error listing the valid types
```
Delete the test entry files afterwards. Don't commit them.

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] From an agent connected to VibeDoc, call vibedoc_save_entry with type "convention" and a one-line summary → a new file memory/entries/E001-<summary-slug>.md appears in the project
- [ ] Open that file → it starts with "# E001: <summary>", then **Type:** and **Updated:** (today) lines, then the body
- [ ] Call vibedoc_save_entry again with id "e1" and a different summary → the same id is kept, the old file is gone and a file with the new slug replaces it
- [ ] Call vibedoc_save_entry with type "rule" → the agent gets an error listing convention, gotcha, decision, preference, and no file is written
- [ ] Open /activity → each save shows as "Entry E00N saved" with the summary
### Regression risk
- [ ] vibedoc_update_memory still rewrites memory/MEMORY.md, and the Memory tab shows it as before
