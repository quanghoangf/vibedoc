# T523: Agents get the same structure as text; close R097
**Status:** 📋 Todo
**Phase:** R097 — Diagrams from project data
**Size:** M (2–3 hrs)
**Depends on:** T520, T521
**Covers:** S5

## Goal
What people see in the diagrams, agents get as compact text from MCP: `vibedoc_get_task` ends with the task's upstream/downstream with statuses, and `vibedoc_get_roadmap { id }` returns one epic's tasks with status, dependency order and scenario coverage. Doc links are already in `vibedoc_read_doc`'s `## Related files` (R056) — confirm, don't duplicate.

## Context
- Epic: `plans/roadmap/R097-diagrams-from-project-data.md`
- Same pure graphs as the UI: `taskNeighbourhood` / `epicGraph` in `src/lib/item-diagrams.ts` (T520/T521) + new text formatters, so the UI and MCP can't drift.
- `vibedoc_get_task` handler: `src/app/api/mcp/route.ts:380` (appends `relatedEntries` / `relatedSpecs` via `withGap`) — add `## Dependencies` the same way; nothing when the task has no deps/dependents.
- `vibedoc_get_roadmap`: `route.ts:744`; add an optional `id` arg in `src/lib/mcp-tools.ts` (the tool list feeds the site's generated tool pages; tool count stays 48). With `id` → that item's detail; without → unchanged output.
- Format (compact, one line per node):
  ```
  ## Dependencies
  Waits on: T508 ✓ done · T505 ◐ in-progress
  Blocks: T510 ○ todo
  ```
  Epic: `T513 ✓ themed mermaid → covers S1` lines in dependency order, then `Scenarios: S1 passed · S2 unproven (no task covers S6)`.

## Scope
- [ ] Formatters `formatTaskDeps`, `formatEpicMap` in `item-diagrams.ts` + check cases
- [ ] MCP: `## Dependencies` on `vibedoc_get_task`; `id` on `vibedoc_get_roadmap` (description updated)
- [ ] `e2e/derived-diagrams.mjs`: S5 section via `POST /api/mcp` — get_task on the fixture's middle task lists both sides; get_roadmap `{id}` lists tasks + coverage
- [ ] Done-when end to end in the same e2e: open a task, an epic and a doc → each shows its diagram; change a status → live update
- [ ] `docs/architecture/02-high-level-design/HLD.md` / `memory/MEMORY.md` conventions: one line on derived diagrams (`item-diagrams.ts`, never stored)
- [ ] Mark R097 done when every task is done

**Out of scope:** Mermaid source over MCP (text lines are cheaper for agents), new MCP tools.

## Files
- `src/lib/item-diagrams.ts`, `src/lib/item-diagrams.check.mts`, `src/app/api/mcp/route.ts`, `src/lib/mcp-tools.ts`
- `e2e/derived-diagrams.mjs`, `memory/MEMORY.md`, `plans/roadmap/R097-diagrams-from-project-data.md`

## Acceptance criteria
- [ ] `vibedoc_get_task` for a task with deps ends with `## Dependencies` (both sides, statuses); without deps the reply is unchanged
- [ ] `vibedoc_get_roadmap { id: "R097" }` returns its tasks in dependency order with covers + scenario statuses; no `id` = same output as before
- [ ] `pnpm --dir site test` still passes (tool pages); check + e2e pass; `pnpm build` ok

## Verify
```bash
node src/lib/item-diagrams.check.mts
pnpm build && pnpm --dir site test
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/derived-diagrams.mjs
```

## Manual tests
### Steps
- [ ] S5 — WHEN an agent calls `vibedoc_get_task` or `vibedoc_get_roadmap` → THEN the reply includes the dependency / coverage structure as compact text
