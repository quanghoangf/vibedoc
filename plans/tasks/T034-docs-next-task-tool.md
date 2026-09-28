# T034: Docs — vibedoc_next_task in mcp-tools.md and README
**Status:** ✅ Done
**Phase:** R037 — Agent work queue
**Size:** S (~1 hr)
**Depends on:** T031

## Goal
Users and agents find the work queue in the docs. The recommended agent workflow uses `vibedoc_next_task` instead of hand-picking tasks.

## Context
- Epic: `plans/roadmap/R037-agent-work-queue.md`
- `docs/architecture/mcp-tools.md` has an "ideal workflow" list (~lines 26–35) that currently says: `vibedoc_update_task ← mark in-progress when you start`. It has one `###` section per tool (e.g. `### vibedoc_update_task` ~line 97).
- `README.md` says "24 tools" in two places (~lines 53 and 101) and has a grouped tool table under `## MCP tools`.
- The tool contract is defined in T030/T031. Copy its input and the three response kinds from the code, not from memory.

## Scope
- [ ] `mcp-tools.md`: add a `### vibedoc_next_task` section (input, claim semantics, the three response kinds, and one example per kind)
- [ ] `mcp-tools.md`: change the workflow list to: read memory → `next_task { epic }` → work → `update_task done` → repeat. Keep manual `update_task in-progress` as the path for tasks outside an epic
- [ ] `README.md`: count the tools in `/api/mcp/route.ts`, update both counts to match, and add the tool to the table
- [ ] `docs/architecture/02-high-level-design/HLD.md`: add `vibedoc_next_task` to the "AI starts a session" ideal-workflow notes, if they list tool steps
- [ ] Bump the "Last updated" date on each doc you edit

**Out of scope:** the landing site (R042), and documenting the `/work-epic` skill beyond one line and a link.

## Files
- `docs/architecture/mcp-tools.md`
- `README.md`
- `docs/architecture/02-high-level-design/HLD.md` (only if it lists tool steps)

## Implementation notes
- Count the tools with `grep -c 'name: "vibedoc_' src/app/api/mcp/route.ts`. Don't assume 25; the count has drifted before.
- Mention that claiming is atomic within one VibeDoc process, and that stale in-progress tasks are not reclaimed automatically.

## Acceptance criteria
- [ ] The README tool count equals the `grep -c` result
- [ ] `mcp-tools.md` documents the input, the claim behavior and all three response kinds
- [ ] The workflow in `mcp-tools.md` uses `next_task`

## Verify
```bash
grep -c 'name: "vibedoc_' src/app/api/mcp/route.ts
grep -n "tools" README.md | head
grep -n "vibedoc_next_task" docs/architecture/mcp-tools.md README.md
```
