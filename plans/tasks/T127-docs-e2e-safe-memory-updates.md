# T127: Docs + e2e for safe memory updates
**Status:** 📋 Todo
**Phase:** R045 — Safe memory updates
**Size:** M (2–3 hrs)
**Depends on:** T125, T126

## Goal
The epic's two Done-when criteria are proven in a browser test, and agents and people can read how partial updates and restore work.

## Context
- Epic: `plans/roadmap/R045-safe-memory-updates.md`
- e2e pattern: `e2e/memory-cleanup.mjs` uses real routes on a mktemp fixture with only `/api/projects` stubbed, and fails on any console error. Run with `PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/<name>.mjs`.

## Scope
- [ ] `e2e/memory-safe-updates.mjs`:
  1. The fixture MEMORY.md has a hand-written `## Key conventions` section. Call `vibedoc_update_memory {handoff:"new"}` through `/api/mcp?root=` → `/memory` shows the new handoff and the conventions section is unchanged.
  2. History lists the earlier version; Restore → the old handoff is back; Undo → the new one is back.
  3. `vibedoc_memory_history` lists the versions; restore through MCP updates the open page live (SSE).
- [ ] Docs:
  - [ ] `docs/architecture/mcp-tools.md`: `vibedoc_update_memory` (partial updates; the section ↔ field table) and a new `vibedoc_memory_history` section.
  - [ ] `docs/architecture/03-services/mcp-server/TOOLS.md`: the same, briefly.
  - [ ] `docs/architecture/04-data/DATA.md`: the `.vibedoc/memory-history/` row.
  - [ ] `memory/MEMORY.md` Key conventions: one line on R045.

**Out of scope:** new behaviour; if the e2e finds a bug, fix it here and note it.

## Files
- `e2e/memory-safe-updates.mjs`: new
- the docs listed above

## Acceptance criteria
- [ ] The e2e passes against `pnpm dev` and against `pnpm build && pnpm start`.
- [ ] The docs match the shipped tool schemas (field names, defaults, the 20-version cap).
- [ ] Every `*.check.mts` passes; lint is no worse than the baseline.

## Verify
```bash
for f in src/lib/*.check.mts src/components/*/*.check.mts; do node $f || echo FAIL $f; done
pnpm lint && pnpm build
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/memory-safe-updates.mjs
```
