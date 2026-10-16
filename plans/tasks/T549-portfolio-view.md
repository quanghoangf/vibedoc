# T549: Portfolio view on All projects
**Status:** 📋 Todo
**Phase:** R106 — Portfolio overview
**Size:** M (2–3 hrs)
**Depends on:** T548, T531
**Covers:** S1

## Goal
All projects gets a Portfolio view that shows, per project or group, progress, what is at risk and what agents did this week, with one click into the project's roadmap.

## Context
- Epic: `plans/roadmap/R106-portfolio-overview.md`
- `/projects?view=portfolio` (List stays the default view). Row: name, progress bar (epics done/total), at-risk/overdue chips naming epics, done this week `🤖 n · 👤 m`, last activity (local time via `useFormat()`).
- Click → `/roadmap?project=<id>` (or `?item=` from an at-risk chip).
- Visual language: DESIGN.md tokens; at-risk uses the roadmap's existing ⚠ treatment.
- Rule: i18n `src/i18n/projects.ts`.

## Scope
- [ ] View switch on `/projects` (URL `view`)
- [ ] `PortfolioRow` component; groups as expandable rows
- [ ] Refresh on `projects_updated`, `task_updated`, `roadmap_updated` SSE

**Out of scope:** export/reports.

## Files
- `src/app/(app)/projects/page.tsx`, `src/components/projects/PortfolioRow.tsx` — new
- `src/i18n/projects.ts`
- `e2e/projects-hub.mjs` — extend

## Acceptance criteria
- [ ] With one at-risk project of three, it is the first row and names the epic (epic Done when)
- [ ] Clicking the epic chip opens that epic in its project
- [ ] Phone width (390px): no horizontal scroll

## Manual tests
- [ ] S1 — WHEN one project has an at-risk epic and the others don't → THEN that project sorts first with the epic named

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/projects-hub.mjs
```
