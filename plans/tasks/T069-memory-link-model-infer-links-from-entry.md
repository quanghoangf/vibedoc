# T069: Memory link model — infer links from entry text + /api/memory/graph
**Status:** ✅ Done
**Phase:** R053 — Memory graph
**Size:** M
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-03
**Started:** 2026-09-30
**Done:** 2026-09-30

## Goal
VibeDoc knows, for every memory entry, which tasks, epics, ADRs, docs and other entries it mentions and which of those mention it back. That comes out as one graph (nodes + edges) that the panel, the MCP output and the graph view all read from.

## Context
- Epic: `plans/roadmap/R053-memory-graph.md`
- **Blocked on R046 (Project knowledge entries).** This assumes the entry files and the list function from R046 exist, plus the `RecallEntry` mapping from T065.
- Decided: links are **inferred from text**. There's no `**Links:**` meta line and no new format. The scan works like `findBacklinks()` in `core.ts` (T026).
- Out of scope for the epic: any database or vector store. The graph is built on request from the files.
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches the file system. Pure logic goes in its own `src/lib/*.ts` with a `*.check.mts` self-check, the way `work-queue.ts` does.

## Scope
- [ ] `src/lib/memory-graph.ts` (new, pure): `extractRefs(text)` and `buildGraph(...)`
- [ ] `src/lib/memory-graph.check.mts` (new): assert-based self-check
- [ ] `core.ts`: `getMemoryGraph(root)` loads entries, tasks, roadmap items and docs, extracts refs and resolves them
- [ ] `src/app/api/memory/graph/route.ts` (new): `GET` returns the graph as JSON. Optional `?entry=E012` returns only that entry and its direct neighbours

**Out of scope:** UI (t3, t5), MCP output (t2), history (t4).

## Files
- `src/lib/memory-graph.ts`, `src/lib/memory-graph.check.mts`: new
- `src/lib/core.ts`: add `getMemoryGraph()` next to `findBacklinks()`
- `src/app/api/memory/graph/route.ts`: new, same shape as `api/backlinks/route.ts`

## Implementation notes
Pin this shape, because t2–t5 build on it:

```ts
export type NodeKind = 'entry' | 'task' | 'epic' | 'adr' | 'doc'
export type GraphNode = { id: string; kind: NodeKind; label: string; path: string }
export type GraphEdge = { from: string; to: string }         // from mentions to
export type MemoryGraph = { nodes: GraphNode[]; edges: GraphEdge[] }
export function extractRefs(text: string): { ids: string[]; paths: string[] }
```
- Id patterns: entry ids (R046's format, e.g. `E\d+`), `T\d{3}`, `R\d{3}`, `ADR-\d+`. Doc paths are `*.md` inside backticks or markdown link targets.
- Outgoing edges come from entry bodies. Incoming edges come from scanning task, roadmap and doc files for entry ids **only** (don't build the whole doc-to-doc graph).
- Drop refs that don't resolve to an existing item, and drop self-links. Remove duplicate edges.
- Only nodes that touch at least one entry go in the graph, plus every entry, including ones with no links.
- Skip `node_modules`, `.git` and `.next`, as `findBacklinks` does.

## Acceptance criteria
- [ ] An entry body mentioning `T065`, `R048` and `` `docs/architecture/HLD.md` `` produces 3 edges to existing nodes
- [ ] A task file that mentions an entry id produces an incoming edge to that entry
- [ ] Refs to missing items and self-links are dropped
- [ ] `GET /api/memory/graph?entry=<id>` returns the entry and its neighbours only
- [ ] Unit tests: id patterns, path in backticks vs link target, no false match inside longer tokens (for example `XT0651`), de-duplication, dropping unresolved refs

## Verify
```bash
node src/lib/memory-graph.check.mts
pnpm build && pnpm lint
curl -s 'localhost:3000/api/memory/graph' | head -c 800
```

## Manual tests
_2026-09-30 — ai_
### Steps
- [ ] Save an entry whose details mention a task id, an epic id and a doc path in backticks (e.g. `docs/architecture/HLD.md`), then open /api/memory/graph?entry=<its id> → the entry, that task, epic and doc, and one edge to each
- [ ] Add the entry id (e.g. E001) to a task file and reload the URL → an edge from that task to the entry
- [ ] Mention an id that doesn't exist (T999) or the entry's own id → no node or edge for it
- [ ] Open /api/memory/graph → every entry is listed, including ones with no links; tasks or docs that never touch an entry are not
- [ ] Open /api/memory/graph?entry=bad → a 400 error
### Regression risk
- [ ] The "Referenced by" backlinks panel on a doc still lists the docs that link to it
