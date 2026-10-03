# T117: Handoff vs board contradictions + warning in vibedoc_read_memory
**Status:** 📋 Ready
**Phase:** R051 — Memory cleanup & staleness
**Size:** M
**Depends on:** —

## Goal
When `memory/MEMORY.md` says T055 is being worked on but T055 is done, the next agent that calls `vibedoc_read_memory` sees a warning such as `⚠ Handoff says T055 is in progress, but it is done` before it trusts the handoff. This is the thin end-to-end path of the epic and covers its first Done-when criterion.

## Context
- Epic: `plans/roadmap/R051-memory-cleanup-and-staleness.md`
- Decided: the epic covers board contradictions, duplicates + merge, and "not recalled lately". Detecting entries that contradict each other is out of scope. Nothing is ever deleted without a person approving it.
- Decided: warnings show up in two places, `vibedoc_read_memory` (this task) and a Cleanup panel on the Memory tab (T+1). There is no separate MCP health tool.
- Reuse `extractRefs()` from `src/lib/memory-graph.ts` (R053 T069) to find `T\d{3}` / `R\d{3}` ids. Don't write a second id regex.
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches the file system. Pure logic goes in its own `src/lib/*.ts` with a `*.check.mts` self-check (see `src/lib/work-queue.ts`, `src/lib/recall.ts`). `/api/mcp` is hand-rolled JSON-RPC.

## Scope
- [ ] `src/lib/memory-health.ts` (new, pure): the `HealthFlag` type and `findContradictions()`
- [ ] `src/lib/memory-health.check.mts` (new): assert-based self-check
- [ ] `core.ts`: `getMemoryHealth(root)` loads MEMORY.md, the entries, the tasks and the roadmap items, then returns the flags
- [ ] `vibedoc_read_memory`: add a `## ⚠ Memory warnings` block directly under the handoff when there are any `warn` flags

**Out of scope:** the UI panel and dismissing flags (next task), duplicates, stale entries, merge.

## Files
- `src/lib/memory-health.ts`, `src/lib/memory-health.check.mts`: new
- `src/lib/core.ts`: `getMemoryHealth()` in a new `// ─── Memory health ───` section after the knowledge-entry functions
- `src/app/api/mcp/route.ts`: the `vibedoc_read_memory` case

## Implementation notes
Pin this shape, because the later tasks add more flag kinds to it:

```ts
export type HealthKind = 'contradiction' | 'dangling-ref' | 'duplicate' | 'stale'
export type HealthFlag = {
  id: string            // stable key, e.g. "contradiction:handoff:T055", used for dismissing
  kind: HealthKind
  severity: 'warn' | 'info'
  message: string       // one line, shown as is in the UI and MCP output
  refs: string[]        // item ids involved (T055, E012, …)
  suggestion?: { action: 'merge' | 'delete'; ids: string[] }
}
export type BoardStatus = { id: string; status: string }   // tasks + roadmap items
export function findContradictions(handoff: string, entries: { id: string; body: string; summary: string }[], board: BoardStatus[]): HealthFlag[]
```

Rules:
- Split MEMORY.md into its sections. Check `updateMemory()` in `core.ts` for the exact headings (working on / just completed / up next / current state).
- A task or epic named under **Working on** or **Up next** whose status is `done` or `cancelled` → `warn` contradiction: `Handoff says T055 is in progress, but it is done`.
- A task named under **Just completed** whose status is not `done` → `warn`: `Handoff says T055 is done, but it is in-progress`.
- A `T`/`R` id in the handoff or an entry body that doesn't exist on the board → `info`, kind `dangling-ref`, `E012 mentions T999, which doesn't exist`.
- Mentions of done tasks in **entries** are fine (entries are long-lived facts), so don't flag them.
- One flag per (section, id). The order is warn before info, then by id.
- In `vibedoc_read_memory`, list `warn` flags only, at most 5, plus `…and N more on /memory` when there are more. When there are only `info` flags, add the single line `ℹ N memory cleanup suggestions on /memory`. Keep it short, because this output counts against the session-start token budget (T067).

## Acceptance criteria
- [ ] A MEMORY.md whose Working on names a done task makes `vibedoc_read_memory` show the warning naming that task and its real status
- [ ] Just completed naming an in-progress task shows the reverse warning
- [ ] A handoff that matches the board shows no warning block, and the output is unchanged
- [ ] An entry mentioning a missing T999 makes a `dangling-ref` info flag
- [ ] The self-check covers section splitting, both directions of contradiction, cancelled tasks, epics (R ids), dangling refs, de-duplication and ordering

## Verify
```bash
node src/lib/memory-health.check.mts
pnpm typecheck && pnpm build && pnpm lint
# put a done task id under "Working on" in memory/MEMORY.md, then:
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_read_memory","arguments":{}}}'
```
Revert the MEMORY.md edit afterwards.
