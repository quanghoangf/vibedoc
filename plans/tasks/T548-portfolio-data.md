# T548: Portfolio numbers per project and group
**Status:** ✅ Done
**Phase:** R106 — Portfolio overview
**Size:** M (2–3 hrs)
**Depends on:** T538
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16
**Done:** 2026-10-16

## Goal
One endpoint answers "how is each project doing": epic progress, at-risk and overdue epics, tasks done this week by agents and by people, last activity, sorted by attention needed.

## Context
- Epic: `plans/roadmap/R106-portfolio-overview.md`
- Reuse, don't recompute: `roadmapHealth(items, taskInfo, localToday())` (`src/lib/roadmap-health.ts`) for progress + drift (`at-risk`, overdue); activity log `readActivity(root, 2000)` for done-this-week split by actor (`ai` vs human, `src/lib/activity.ts` `eventCategory`).
- "This week" = the last 7 local days (`localToday()`), dates as strings, never `new Date("YYYY-MM-DD")`.
- Attention score: at-risk epics × 3 + overdue × 2 + blocked tasks; ties by last activity.
- Groups: a row per group sums its members, with members nested.

## Scope
- [ ] Pure `src/lib/portfolio.ts` (`projectStats`, `attentionSort`, `groupRollup`) + `portfolio.check.mts`
- [ ] core `getPortfolio()`; `GET /api/portfolio`

**Out of scope:** the view (T549); long-range charts.

## Files
- `src/lib/portfolio.ts`, `src/lib/portfolio.check.mts` — new
- `src/lib/core.ts`, `src/app/api/portfolio/route.ts` — new

## Acceptance criteria
- [ ] Fixture: one project with an at-risk epic, two without → it sorts first, with the epic's id and title
- [ ] Done this week counts `ai` and human separately
- [ ] `node src/lib/portfolio.check.mts` passes

## Verify
```bash
node src/lib/portfolio.check.mts
pnpm lint && pnpm build
curl -s localhost:3081/api/portfolio | head
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] S1 — WHEN one project has an at-risk epic and the others don't → THEN that project sorts first with the epic named (3 fixture projects, Bravo with a blocked task: `GET /api/portfolio` lists Bravo before Alpha/Charlie with "Bravo epic" in atRisk)
- [x] With a temp hub, `curl /api/portfolio` → JSON rows with epics, atRisk, overdue, blocked, doneThisWeek {ai, human}, lastActivity, attention
### Regression risk
- [x] `GET /api/projects?counts=1` and `GET /api/groups` still answer as before
