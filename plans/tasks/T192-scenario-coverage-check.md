# T192: Scenario coverage check
**Status:** 👀 Review
**Phase:** R068 — Scenarios as acceptance tests
**Size:** M (2–3 hrs)
**Depends on:** T191
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
Gaps show up before the agent starts: a scenario no task covers, or a task tied to no scenario, is visible on the plan and on the roadmap (Spec Kit's `/analyze`, scoped to what VibeDoc stores).

## Context
- Epic: `plans/roadmap/R068-scenarios-as-acceptance-tests.md`.
- Drift lives in `src/lib/roadmap-health.ts` (pure, kinds `status-mismatch | missing-task | overdue | at-risk`), shown in the roadmap "need attention" panel (`RoadmapTab.tsx`) and in `vibedoc_get_roadmap`.
- roadmap-health can't import scenarios.ts (pure libs don't import each other): core passes parsed scenarios / covers in, or the item already carries them (T190 put them on `RoadmapItem` / `Task`).

## Scope
- [ ] Pure `coverage(scenarios, tasks)` in `scenarios.ts` → `{ uncovered: string[], untied: string[] }` (untied = tasks of the epic with no covers; cancelled tasks ignored).
- [ ] Plan card: warnings under the plan (not blocking) when the proposed tasks leave scenarios uncovered.
- [ ] Drift kind `uncovered-scenario` in `roadmap-health.ts` for planned / in-progress epics that have scenarios and at least one task. No scenarios → no drift (scenarios stay optional).
- [ ] Checks for both.

**Out of scope:** judging whether a task really tests the scenario (R067 / R063 do that).

## Files
- `src/lib/scenarios.ts`, `src/lib/scenarios.check.mts`
- `src/lib/roadmap-health.ts`, `src/lib/roadmap-health.check.mts`
- the plan card component, `src/components/roadmap/RoadmapTab.tsx` (only if the new kind needs a label)

## Acceptance criteria
- [ ] An epic with S1–S3 and tasks covering S1, S2 → "R0xx: S3 not covered by any task" in need-attention and `vibedoc_get_roadmap`.
- [ ] A plan leaving S3 uncovered shows the warning before Accept.
- [ ] Epics without scenarios produce no new drift.

## Verify
```bash
node src/lib/scenarios.check.mts && node src/lib/roadmap-health.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-05 — ai · Spec: `e2e/vibedoc/T192-scenario-coverage-check.spec.ts` · Auto: passed 2026-10-05_
### Steps
- [x] 🤖 Open /roadmap with an epic whose task covers none of its scenarios → need attention lists "S1, S2 not covered by any task" for it
- [x] 🤖 Ask the agent for a breakdown of that epic that covers only S1 → the plan card warns "S2 not covered by any task" before Accept
- [ ] On the map, that epic carries the ⚠ marker; clicking the need-attention row opens its sheet
- [ ] A plan where one task has no covers (epic with scenarios) → the card also says "<task title>" covers no scenario
### Regression risk
- [ ] Epics without `## Scenarios` show no new need-attention rows, and the status-mismatch rows still offer their "→ status" button
