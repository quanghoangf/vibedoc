# T122: Docs + e2e for memory cleanup
**Status:** ✅ Done
**Phase:** R051 — Memory cleanup & staleness
**Size:** M
**Depends on:** T120, T121
**Done:** 2026-10-03

## Goal
The cleanup feature is documented for both people and agents, and an e2e test proves the epic's two Done-when criteria end to end.

## Context
- Epic: `plans/roadmap/R051-memory-cleanup-and-staleness.md`
- Done when: "a handoff that names a finished task as in progress shows a warning, and approving a suggested merge leaves one entry".
- The repo has Playwright e2e tests (see the recent `test(e2e)` commits). Copy the setup and fixture-project pattern of the existing Memory browser e2e (T092).

## Scope
- [ ] e2e: seed a fixture project with a done task named under Working on in MEMORY.md and two near-duplicate entries. Open `/memory` and check that Cleanup shows the contradiction and the duplicate group. Merge, then check that one entry file remains. Undo, then check that both are back
- [ ] e2e or curl check: `vibedoc_read_memory` output contains the warning line
- [ ] Docs: the Memory/knowledge-entries doc and `mcp-tools.md` explain the cleanup flags, the `vibedoc_read_memory` warning block, that `vibedoc_get_entries` updates the recall log, and the two sidecar files `memory/.cleanup.json` and `memory/.recall-log.json` (whether to commit them is the project's choice; they are kept diff-friendly)
- [ ] Agent guidance (CLAUDE.md template / planning guidance from T088): when `vibedoc_read_memory` shows a warning, fix the handoff with `vibedoc_update_memory` before starting work

**Out of scope:** new features.

## Files
- the e2e test folder: a new `memory-cleanup` spec next to the Memory browser spec
- `docs/…/mcp-tools.md`, the knowledge-entries doc, and the agent guidance file T088 touched (search for `vibedoc_save_entry` to find them)

## Acceptance criteria
- [ ] The e2e spec passes locally and covers both Done-when criteria
- [ ] The docs mention every new route, sidecar file and the warning block
- [ ] Run `vibedoc_rebuild_registry` if docs were added

## Verify
```bash
pnpm typecheck && pnpm build && pnpm lint
pnpm test:e2e   # or the project's e2e script; check package.json
```

## Manual tests
_2026-10-03 — ai_
### Steps
- [ ] In a project's MEMORY.md, list a done task under "## Working on now", then call vibedoc_read_memory → the reply has "## ⚠ Memory warnings" with "Handoff says T… is in progress, but it is done" right under the handoff
- [ ] Open /memory → the Cleanup (N) button counts the flag; click it → the contradiction row shows, with the task id in mono
- [ ] Save two entries that say the same thing → Cleanup shows "E… and E… look like duplicates" with Merge…
- [ ] Merge… → Merge into E… → only one entry file is left in memory/entries/ and the duplicate row is gone when you reopen Cleanup
- [ ] Click Undo in the toast → both entry files are back unchanged and Cleanup lists the duplicate again
- [ ] Read docs/architecture/mcp-tools.md "Memory cleanup" → flags, warning block, recall log, memory/.cleanup.json, memory/.recall-log.json and the four routes are explained
### Regression risk
- [ ] vibedoc_read_memory on a clean project still returns the handoff and the knowledge entry index with no warning block
- [ ] Merge and Undo from the Memory tab (e2e/memory-merge.mjs) still pass
