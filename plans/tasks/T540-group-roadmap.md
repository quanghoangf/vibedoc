# T540: Group roadmap
**Status:** ✅ Done
**Phase:** R102 — Project groups
**Size:** M (2–3 hrs)
**Depends on:** T539
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16
**Done:** 2026-10-16

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

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/project-groups.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] Open `/roadmap?group=shop` (web 2 epics, api 3) → one Timeline with a "web · 2 epics" and an "api · 3 epics" header, all 5 epics under their own repo, on one month axis (e2e/project-groups.mjs)
- [x] The Map tab is disabled in a group; hovering it says the map is per project (e2e: disabled, wrapper title)
- [x] An epic due in 3 days with nothing started shows ⚠ on the group timeline exactly where its repo's own roadmap (`vibedoc_get_roadmap`) says at risk, for both repos (e2e)
- [x] Click an epic on the group timeline → it opens in its own project (`/roadmap?project=<repo>&item=R003`) (e2e)
- [x] The group timeline reads well at 1400px and 390px (checked on screenshots)
### Regression risk
- [x] A single project's Roadmap Timeline still renders in English and Vietnamese (`e2e/i18n.mjs`: "roadmap: timeline: no English UI text")
