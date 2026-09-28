# T032: "Next up" marker in the roadmap sheet
**Status:** ✅ Done
**Phase:** R037 — Agent work queue
**Size:** S (~1 hr)
**Depends on:** T031

## Goal
When a human opens an epic on the roadmap, the task list shows which task an agent would get next. If there's none, it shows why (finished, or what it's waiting on). The human can then see the queue's view before starting an agent.

## Context
- Epic: `plans/roadmap/R037-agent-work-queue.md`
- The task list is `LinkedTasks` in `src/components/roadmap/RoadmapItemSheet.tsx`. It already gets `tasksById` (every board task) and renders the epic's tasks in `item.tasks` order.
- Reuse `pickNextTask()` from `src/lib/work-queue.ts`, which is pure and safe in the browser. Don't reimplement the rules and don't call MCP from the UI.
- Board data refreshes live via AppContext on `task_updated`, so the marker follows claims automatically.
- Tailwind only, and use the existing tokens (`text-accent`, `text-amber`, `text-muted`). Don't add colors or `localStorage`.

## Scope
- [ ] Compute `pickNextTask(item, Object.values(tasksById))` in `LinkedTasks`
- [ ] `ready`: show a small "Next up" pill on that task's row
- [ ] `waiting`: show one muted line under the list with the first reason, and the rest in a `title` tooltip
- [ ] `finished`: show nothing extra, because the progress bar already reads 100%

**Out of scope:** a "Start agent on this" button (R040), claiming from the UI.

## Files
- `src/components/roadmap/RoadmapItemSheet.tsx`: `LinkedTasks` only

## Implementation notes
- `tasksById` values are full `Task`s, which fit the `QueueTask` pick type.
- Put the pill before the status badge, and style it like the existing badge (`rounded-sm border px-1.5 text-[10px]`) using `border-accent/40 text-accent`.
- Wrap the computation in `useMemo` only if the React Compiler lint asks for it. Don't add new react-hooks lint errors: the baseline is 16.

## Acceptance criteria
- [ ] An epic with a ready task shows "Next up" on exactly one row, and it's the task `vibedoc_next_task` would claim
- [ ] After that task is claimed (via MCP), the pill moves live without a reload
- [ ] An epic where everything is in progress or blocked shows the waiting line
- [ ] Horizons and epics without tasks look unchanged

## Verify
```bash
pnpm build && pnpm lint
# pnpm dev, open http://localhost:3000/roadmap?root=<fixture from T030>, click the epic:
#   "Next up" on T001 → run `call vibedoc_next_task '{"epic":"R002"}'` → the pill disappears
#   and the waiting line shows "T002 waits on T001 (in-progress)"
```
