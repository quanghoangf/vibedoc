# T193: Epic scenario → tasks → evidence view, e2e and docs
**Status:** 👀 Review
**Phase:** R068 — Scenarios as acceptance tests
**Size:** M (2–3 hrs)
**Depends on:** T192
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
The epic answers "is the promise kept?": each scenario shows passed, failed or unproven from its tasks' latest evidence.

## Context
- Epic: `plans/roadmap/R068-scenarios-as-acceptance-tests.md`. "Done when": breaking down an epic with three scenarios yields tasks whose checklists cover all three, and the epic shows each scenario as passed, failed or unproven.
- Evidence is derived: `src/lib/evidence.ts` `matchItems` (🤖 item ↔ run step by text), manual tests `AutoRun { result, unverified?, flaky? }`, ticks in `## Manual tests`. T191 seeds steps as `S2 — …`, so a step's scenario id is its prefix.

## Scope
- [ ] Pure `scenarioStatus(scenario, tasks)` in `scenarios.ts`: passed = every covering task has the seeded step ticked or passed in its latest run (unverified counts as unproven); failed = any latest run failed that step; else unproven.
- [ ] Epic sheet Scenarios list (T190) shows the status with a link to the task's evidence view (`/manual-tests?task=&view=evidence`).
- [ ] `vibedoc_get_roadmap` adds `scenarios 2/3 passed` per epic that has scenarios.
- [ ] `e2e/scenarios.mjs` (follow `e2e/manual-tests-review.mjs`): epic with 3 scenarios → accept a breakdown plan → 3 seeded tasks → tick one, fail one → sheet shows passed / failed / unproven.
- [ ] Docs: MEMORY.md conventions line (Scenarios section, **Covers:**, seeding, drift, status rule), `skills/roadmap-planner/SKILL.md` (epics may carry `## Scenarios`), mcp-tools.md.
- [ ] Mark R068 done when the "Done when" holds.

## Files
- `src/lib/scenarios.ts`, `src/lib/scenarios.check.mts`, `src/lib/core.ts`, `src/app/api/mcp/route.ts`
- `src/components/roadmap/RoadmapItemSheet.tsx`
- `e2e/scenarios.mjs`: new
- `memory/MEMORY.md`, `skills/roadmap-planner/SKILL.md`, `docs/architecture/mcp-tools.md`

## Acceptance criteria
- [ ] `node e2e/scenarios.mjs` passes.
- [ ] Unverified steps (R063) never count as passed.

## Verify
```bash
node src/lib/scenarios.check.mts
pnpm lint && pnpm build
node e2e/scenarios.mjs
```

## Manual tests
_2026-10-05 — ai · Spec: `e2e/vibedoc/T193-scenario-evidence-view-e2e.spec.ts` · Auto: passed 2026-10-05_
### Steps
- [x] 🤖 Open the epic before anything is ticked → S1 and S2 both read "unproven"
- [x] 🤖 Tick the task's S1 step → S1 reads "passed" and links to that task's evidence; S2 stays "unproven"
- [ ] Run a covering task's spec from VibeDoc so it fails on its S-step → the scenario reads "failed" (red) and the chip opens that task's Evidence view
- [ ] The passed / failed / unproven chips read well next to long scenario names, in dark and light
- [ ] vibedoc_get_roadmap on an epic with scenarios → its line ends with "scenarios N/M passed"
### Regression risk
- [ ] /manual-tests Evidence view still opens from a task card's 🧪 badge
