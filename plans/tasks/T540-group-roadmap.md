# T540: Group roadmap
**Status:** 📋 Todo
**Phase:** R102 — Project groups
**Size:** M (2–3 hrs)
**Depends on:** T539
**Covers:** S1

## Goal
`/roadmap?group=` shows the epics of every member repo on one Timeline, grouped by repo, so the user plans the product as one.

## Context
- Epic: `plans/roadmap/R102-project-groups.md`
- Decision: the group roadmap is the **Timeline** view only (`components/roadmap/timeline.ts`), one lane block per repo. The Map stays per project: `layout.json` positions are per repo and merging them is out of scope.
- Read-only aggregate: clicking an epic opens it in its own project (`/roadmap?project=<id>&item=R004`).
- Health per epic reuses `roadmapHealth` from `src/lib/roadmap-health.ts` with that repo's tasks.

## Scope
- [ ] core `listGroupRoadmap(slug)` → items with `project`; `GET /api/roadmap?group=`
- [ ] Timeline: lane header per repo; Map tab disabled with a tooltip in a group
- [ ] i18n strings

**Out of scope:** editing epics in the group view; cross-repo epics.

## Files
- `src/lib/core.ts`, `src/app/api/roadmap/route.ts`
- `src/components/roadmap/timeline.ts` (+ `timeline` check if present), `src/components/roadmap/RoadmapTimeline.tsx`
- `src/app/(app)/roadmap/page.tsx`
- `e2e/project-groups.mjs`

## Acceptance criteria
- [ ] Group of two repos with 2 + 3 epics → Timeline shows 5 under two repo headers
- [ ] Clicking an epic opens it in its own project
- [ ] At-risk marks match each repo's own roadmap

## Manual tests
- [ ] S1 — WHEN a group has two projects with 5 and 3 open tasks → THEN the group board shows all 8, each tagged with its repo

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/project-groups.mjs
```
