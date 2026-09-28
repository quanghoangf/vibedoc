# T037: Task due dates on the map
**Status:** 📋 Todo
**Phase:** R038 — Epic & horizon progress
**Size:** S (~1 hr)
**Depends on:** T035

## Goal
Each epic node on the map shows its task deadlines at a glance: how many tasks are overdue, or when the next open task is due. You no longer need to open the sheet to see them.

## Context
- Epic: `plans/roadmap/R038-epic-and-horizon-progress.md`
- `FeatureNode` in `src/components/roadmap/RoadmapNodes.tsx` shows only the epic's own `DueChip`. Task dues appear only in `RoadmapItemSheet.tsx:248`.
- Node data is enriched in `RoadmapTab.tsx` (`shownNodes`, ~line 225) from `health` and `tasksById`. It is derived and never persisted.
- `roadmap-health.ts` is pure and has a self-check, so the summary logic belongs there.

## Scope
- [ ] Add a pure `taskDueSummary(taskIds, tasks: Record<string, TaskInfo>, today)` to `roadmap-health.ts` that returns `{ overdue: number; next: string | null } | null`. It ignores `done`/`cancelled` tasks and tasks without `due`, and returns `null` when no open task has a due date
- [ ] Add `taskDue?: …` to `RoadmapNodeData` and fill it in `shownNodes` for feature nodes
- [ ] Render a line in `FeatureNode` under the epic's `DueChip`: `2 tasks overdue` in `text-danger` when `overdue > 0`, else `Next task due Oct 3` (use `formatDay`, colored `text-amber` when that date is `'soon'`, else `text-muted`)
- [ ] Add asserts for `taskDueSummary` in `roadmap-health.check.mts`

**Out of scope:** task dues on the Timeline view, horizon nodes, per-task chips on the node.

## Files
- `src/lib/roadmap-health.ts`: `taskDueSummary`
- `src/lib/roadmap-health.check.mts`
- `src/components/roadmap/RoadmapNodes.tsx`: `RoadmapNodeData`, `FeatureNode`
- `src/components/roadmap/RoadmapTab.tsx`: `shownNodes` memo

## Implementation notes
- Match `DueChip`'s styling (`mt-0.5 font-mono text-[10px]`) so the node height grows by at most one line.
- `next` = the minimum `due` string among open tasks not overdue (string compare works for `YYYY-MM-DD`).
- Existing tokens only (`text-danger`, `text-amber`, `text-muted`). No new colors.

## Acceptance criteria
- [ ] An epic with 2 open tasks past due shows "2 tasks overdue" in red on its node
- [ ] An epic with no overdue tasks and one open task due in 3 days shows "Next task due <date>" in amber
- [ ] An epic whose tasks have no due dates, or whose tasks are all done, shows no extra line
- [ ] Changing a task's `**Due:**` or status updates the node live via SSE (no reload)
- [ ] `node src/lib/roadmap-health.check.mts` prints `roadmap-health: ok`

## Verify
```bash
node src/lib/roadmap-health.check.mts
pnpm build && pnpm lint
# pnpm dev → /roadmap on the T035 fixture: the node with the overdue task reads "1 task overdue";
# set that task to done in the board → the line disappears without a reload
```
