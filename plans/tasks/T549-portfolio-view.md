# T549: Portfolio view on All projects
**Status:** 👀 Review
**Phase:** R106 — Portfolio overview
**Size:** M (2–3 hrs)
**Depends on:** T548, T531
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16

## Goal
All projects gets a Portfolio view that shows, per project or group, progress, what is at risk and what agents did this week, with one click into the project's roadmap.

## Context
- Epic: `plans/roadmap/R106-portfolio-overview.md`
- `/projects?view=portfolio` (List stays the default view). Row: name, progress bar (epics done/total), at-risk/overdue chips naming epics, done this week (agent and human icons, labelled "n by agents · m by you this week"), last activity (local time via `useFormat()`).
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

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/projects-hub.mjs
```

## Manual tests
_2026-10-16 — ai · Spec: `e2e/vibedoc/T549-portfolio-view.spec.ts` · Auto: passed 2026-10-16_
### Steps
- [x] 🤖 Open /projects → the List view is selected by default
- [x] 🤖 S1 — WHEN one project has an at-risk epic and the others don't → THEN that project sorts first with the epic named
- [x] 🤖 A Portfolio row shows epic progress, blocked tasks and done this week → "0/1 epics", "1 blocked", "0 by agents · 0 by you this week"
- [x] 🤖 At 390px wide → the Portfolio has no horizontal scroll
- [x] 🤖 Click the at-risk epic chip → that epic opens on its project's roadmap
- [x] 🤖 Click a project name on the Portfolio → its roadmap opens
- [ ] Switch to the light theme and Vietnamese → the amber ⚠ chips, red overdue chips and teal progress bar read clearly and every Portfolio label is translated
- [ ] Put two projects in a group, open Portfolio → one "Group · 2" row; the chevron shows both members nested, and the group name opens the group's roadmap
### Regression risk
- [x] All projects List view: rename, pin, archive, remove, locate, add and clone still work (e2e/projects-hub.mjs passed in full)
