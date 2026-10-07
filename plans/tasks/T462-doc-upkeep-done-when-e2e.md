# T462: Doc upkeep Done-when end to end, close R092
**Status:** ✅ Done
**Phase:** R092 — Doc upkeep agent
**Size:** S (~1 hr)
**Depends on:** T461
**Covers:** S1, S2

## Goal
Prove the epic's Done-when: finishing a task that renames a file flags the doc mentioning it, and Fix docs proposes the corrected path, which on Accept clears the flag.

## Context
- Epic: `plans/roadmap/R092-doc-upkeep-agent.md`
- The stubbed agent (`stubChat` + `toolTurn`) answers Fix docs with `vibedoc_propose_edit { path, edits: [{old_string: "src/a.ts", new_string: "src/b.ts"}] }`; Accept → `PUT /api/docs` → `doc_updated` SSE → lint refetch.

## Scope
- [ ] Extend `e2e/doc-upkeep.mjs`: before T001 is done → no flag; mark T001 done → flag appears live; Fix docs → stubbed propose_edit → Accept → badge gone, `vibedoc_check_docs` has no `outdated-ref`.
- [ ] MEMORY.md R092 bullet; epic status done.

**Out of scope:** a real agent run.

## Files
- `e2e/doc-upkeep.mjs`
- `memory/MEMORY.md`, `plans/roadmap/R092-doc-upkeep-agent.md`

## Acceptance criteria
- [ ] The e2e passes end to end on port 3192.

## Verify
```bash
PORT=3192 pnpm dev   # then: BASE=http://localhost:3192 node e2e/doc-upkeep.mjs
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [x] S1 — WHEN a done task's commits rename or delete a file and a doc still names its old path → THEN that doc is flagged and the flag clears once the doc no longer names the old path (e2e/doc-upkeep.mjs)
- [x] S2 — WHEN the user clicks Fix docs on a flagged doc → THEN the agent's `vibedoc_propose_edit` with the corrected path fixes the doc on Accept (e2e/doc-upkeep.mjs, stubbed agent)
- [ ] In a real project: rename a file in a commit naming a task, mark the task done, open a doc naming the old path → the box appears; Fix docs with a real agent → it proposes the new path; Accept → the box is gone
### Regression risk
- [ ] Accepting an agent's doc edit in the chat still updates an open editor buffer without losing unsaved typing
