# T541: Group-scoped entries reach every project in the group
**Status:** 📋 Todo
**Phase:** R103 — Shared group memory
**Size:** L (half a day)
**Depends on:** T538
**Covers:** S1, S2, S3

## Goal
An agent saves a knowledge entry with group scope in one repo, and agents in the other repos of that group see it at session start, in recall and in a task's related memory, marked as shared.

## Context
- Epic: `plans/roadmap/R103-shared-group-memory.md` — builds spec ADDED `Group entries reach every project in the group` (`memory` capability)
- Decision: **no new storage.** An entry keeps living in its own project's `memory/entries/E*.md` and gains one meta line `**Scope:** group` (absent = project). Committable, nothing to migrate. Shared with every group the project is in (`groups` from T538).
- Reads union: `sessionStartMemory(root)`, `recallEntries(query, opts, root)` and the `## Related memory` footer (`vibedoc_get_task` / `vibedoc_next_task`) read this project's entries plus the group-scoped entries of every hub project sharing a group. A shared line is shown as `E012 (shared · api)`; ids stay per repo, so lookups use `<projectId>:E012` for foreign entries in `vibedoc_get_entries`.
- The session budget (`fitToBudget`, R048) counts shared lines too; own entries first.
- Project not in any group → output byte-for-byte as today (spec scenario + epic S3).

## Scope
- [ ] `src/lib/entries.ts`: parse/format `scope` (`'project' | 'group'`), keep `formatEntryIndex` stable for project-only lists (+ `entries.check.mts`)
- [ ] `src/lib/recall.ts`: rank shared entries with the same scores; label `shared · <name>` (+ check)
- [ ] core: `groupEntries(root)` loops sibling projects' `listEntries` (scope group only); wire into `sessionStartMemory`, `recallEntries`, related-memory, `vibedoc_get_entries`
- [ ] MCP `vibedoc_save_entry` takes `scope` (tool def in `src/lib/mcp-tools.ts`); `vibedoc_save_entry` refuses `scope: group` when the project is in no group
- [ ] Site doc `site/src/content/docs/docs/concepts/memory.md`: "Shared with your group"

**Out of scope:** Memory tab UI (T542); auto-promotion.

## Files
- `src/lib/entries.ts`, `src/lib/recall.ts` (+ checks)
- `src/lib/core.ts` — `sessionStartMemory` (~line 1884), `recallEntries` (~line 2239), `listEntries`, `saveEntry`
- `src/lib/mcp-tools.ts`, `src/app/api/mcp/route.ts` (`vibedoc_save_entry` ~line 548, `vibedoc_recall` ~585)
- `site/src/content/docs/docs/concepts/memory.md`
- `e2e/group-memory.mjs` — new (two fixture repos in one group, MCP calls)

## Acceptance criteria
- [ ] Save with `scope: group` in `api` → next `vibedoc_read_memory` in `web` lists it marked shared (spec scenario Shared fact reaches another repo; epic Done when)
- [ ] A project-scope entry in `api` never appears in `web` (spec scenario Project scope stays put)
- [ ] A project in no group: `vibedoc_read_memory` output unchanged (compare with a snapshot)
- [ ] `vibedoc_recall` in `web` finds the shared entry; `vibedoc_get_entries { ids: ["api:E003"] }` returns its body
- [ ] `node src/lib/entries.check.mts`, `node src/lib/recall.check.mts` pass

## Manual tests
- [ ] S1 — WHEN an agent saves an entry with group scope in project A → THEN the next session in project B of the same group lists it, marked shared
- [ ] S2 — WHEN an entry has project scope → THEN it never appears in other projects of the group
- [ ] S3 — WHEN a project is in no group → THEN memory works exactly as today

## Verify
```bash
node src/lib/entries.check.mts && node src/lib/recall.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/group-memory.mjs
```
