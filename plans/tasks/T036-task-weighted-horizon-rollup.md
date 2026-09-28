# T036: Task-weighted horizon rollup
**Status:** ✅ Done
**Phase:** R038 — Epic & horizon progress
**Size:** S (~1 hr)
**Depends on:** T035

## Goal
A horizon's progress bar reflects real work done across its epics, not just how many epics are fully done. Today a horizon with three half-finished epics reads 0/3.

## Context
- Epic: `plans/roadmap/R038-epic-and-horizon-progress.md`
- Horizon progress is computed in the last loop of `roadmapHealth()` in `src/lib/roadmap-health.ts` (~line 92) as done epics / total epics.
- `Progress` in `RoadmapNodes.tsx` renders `{done, total}` as a bar plus `done/total`. The shape stays the same, and only the numbers change.
- Horizon **status** drift (`expectedStatus` from epic statuses) does not change. Only `progress[h.id]` changes.

## Scope
- [ ] Horizon progress = the sum over its epics of each epic's task progress (`progress[epic.id]` from the per-epic loop)
- [ ] An epic with no counted tasks contributes `{done: status === 'done' ? 1 : 0, total: 1}`, so epics that haven't been broken down still weigh something
- [ ] Update the `R001` assert in `roadmap-health.check.mts` (it becomes `{done: 2, total: 4}`: R002 2/2, R003 0/1, R004 0/1) and add one case with a half-done epic

**Out of scope:** weighting tasks by `**Size:**`, and time-based progress.

## Files
- `src/lib/roadmap-health.ts`: the horizon loop only
- `src/lib/roadmap-health.check.mts`

## Implementation notes
- The per-epic loop runs first, so `progress[epic.id]` already exists when the horizon loop reads it.
- The node tooltip `title` says `N/M done`. For horizons it now counts tasks. Change the title to `N/M tasks done` only if that stays a one-line change in `Progress`. Otherwise leave it.

## Acceptance criteria
- [ ] A horizon with epics at 1/2 and 0/2 tasks shows 1/4
- [ ] A horizon whose epics have no tasks behaves like before (done epics / epics)
- [ ] The horizon status-mismatch drift is unchanged, and the existing asserts for it still pass
- [ ] `node src/lib/roadmap-health.check.mts` prints `roadmap-health: ok`

## Verify
```bash
node src/lib/roadmap-health.check.mts
pnpm build && pnpm lint
# pnpm dev → /roadmap: the "Near-term" horizon bar now counts tasks (e.g. R037's 5 tasks weigh in)
```
