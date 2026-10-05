# T196: Drift: unmerged spec changes and conflicting epics
**Status:** 👀 Review
**Phase:** R069 — Spec changes on epics
**Size:** S (~1 hr)
**Depends on:** T194
**Owner:** ai:claude-code
**Due:** 2026-10-06
**Started:** 2026-10-05

## Goal
Specs don't silently fall behind: a done epic whose spec changes were never merged, or two open epics changing the same requirement, show up in "need attention".

## Context
- Epic: `plans/roadmap/R069-spec-changes-on-epics.md`.
- `src/lib/roadmap-health.ts` is pure and can't import `specs.ts`; have core (or `parseRoadmapFile`) attach the parsed spec-change targets to `RoadmapItem` (e.g. `specChanges: { capability, ops: {op, name}[] }[]`, `specMerged?: string`).

## Scope
- [ ] Drift `spec-unmerged`: status done, has spec changes, no `**Spec merged:**`.
- [ ] Drift `spec-conflict`: two epics not done (or one done-unmerged) with MODIFIED/REMOVED/RENAMED on the same capability + requirement; message names both epics.
- [ ] `roadmap-health.check.mts` cases.

**Out of scope:** resolving conflicts (flag only, per the epic's Out of scope).

## Files
- `src/lib/roadmap-health.ts`, `src/lib/roadmap-health.check.mts`, `src/lib/core.ts`

## Acceptance criteria
- [ ] Both kinds appear in the roadmap panel and `vibedoc_get_roadmap`.
- [ ] Merging (T195) clears `spec-unmerged`.

## Verify
```bash
node src/lib/roadmap-health.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Mark an epic with `## Spec changes` done without merging → /roadmap "need attention" lists '<id> "<title>" is done but its spec changes aren't merged into <capability>'
- [ ] Merge it from the epic sheet → that row disappears
- [ ] Give two open epics a MODIFIED / REMOVED on the same requirement of one capability → "need attention" lists "<A> and <B> both change "<name>" in <capability>" (and vibedoc_get_roadmap shows the same rows)
### Regression risk
- [ ] On this repo's roadmap, "need attention" shows no new rows (no epic here has spec changes yet)
