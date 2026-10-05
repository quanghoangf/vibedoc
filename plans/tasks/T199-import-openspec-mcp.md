# T199: vibedoc_import_openspec: preview and apply
**Status:** 📋 Todo
**Phase:** R070 — OpenSpec import
**Size:** M (2–3 hrs)
**Depends on:** T198

## Goal
An agent (and, in T200, the UI) can preview what an OpenSpec repo would become on the board and then import it without duplicates.

## Context
- Epic: `plans/roadmap/R070-openspec-import.md`.
- Follow R052's `vibedoc_import_memory` / `importClaudeMemory()` in core: preview unless `apply: true`, a `**Source:**` dedupe key, nothing deleted.
- Writes go through existing core paths: `createRoadmapItem()` (under `withRoadmapLock`), task creation as `applyPlan()` does, doc writes for specs. Emit `roadmap_updated` / `task_updated` / `doc_created` after.
- Capability specs live at `docs/specs/<capability>.md` (R066). Spec deltas map to R069's `## Spec changes` format when R069 is in (else append the delta text under `## Spec changes` verbatim). OpenSpec deltas put requirements at `###` under `## ADDED Requirements`; R069's epic format puts them at `#### ADDED Requirement: <name>` under `### <capability>`, so convert heading levels (one level down) and move the op into the requirement heading.

## Scope
- [ ] core `importOpenSpec(root, { apply, horizon })`:
  - Specs: `docs/specs/<capability>.md` only when absent; existing ones are listed as skipped.
  - Each change → an epic under `horizon` (default: the first in-progress horizon), with its tasks linked; archived changes → status done, tasks done.
  - Dedupe: a change whose `openspec:<id>` source already exists is skipped (or, for an open change, its new groups added as tasks; nothing rewritten).
  - Result: counts + per item `created | skipped (reason)`.
- [ ] MCP `vibedoc_import_openspec { apply?, horizon? }`; `docs/architecture/mcp-tools.md`.
- [ ] Never writes inside `openspec/`.

**Out of scope:** writing back to OpenSpec, syncing later edits (re-import adds, never updates).

## Files
- `src/lib/core.ts`, `src/app/api/mcp/route.ts`, `docs/architecture/mcp-tools.md`

## Acceptance criteria
- [ ] Preview on the fixture lists every change and spec with what would be created; nothing is written.
- [ ] Apply twice → the second run creates nothing.
- [ ] Unknown horizon → error listing horizons.

## Verify
```bash
node src/lib/openspec.check.mts
pnpm lint && pnpm build
```
