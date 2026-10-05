# T191: Breakdown seeds each task's Manual tests from its scenarios
**Status:** 📋 Todo
**Phase:** R068 — Scenarios as acceptance tests
**Size:** M (2–3 hrs)
**Depends on:** T190

## Goal
When an epic with scenarios is broken down, each task starts with a test checklist taken from the scenarios it covers, so the evidence later proves the epic's promise.

## Context
- Epic: `plans/roadmap/R068-scenarios-as-acceptance-tests.md`.
- `src/lib/plan.ts`: `PlanTask { key, title, size?, dependsOn?, due?, body }`, validated by `validatePlan`; `applyPlan()` in core writes the tasks.
- `saveManualTests()` in core + `src/lib/manual-tests.ts` own the `## Manual tests` format; an agent's later report replaces the section.
- The breakdown instructions live in `skills/epic-breakdown/SKILL.md` and `readPlanningSkill()` feeds them to the chat.

## Scope
- [ ] `PlanTask.covers?: string[]`; `validatePlan` rejects ids not in the target epic's scenarios (needs the epic's scenarios in `PlanContext`), and lists the valid ids in the error.
- [ ] `applyPlan()` writes `**Covers:**` and, when covers is set, a seed `## Manual tests` with one step per covered scenario: `- [ ] S2 — WHEN … → THEN …`.
- [ ] Plan card in the chat shows each task's covers.
- [ ] `skills/epic-breakdown/SKILL.md`: when the epic has `## Scenarios`, every task sets `covers` and every scenario is covered; when it has none, offer to write them from "Done when" first.
- [ ] Checks: plan.check.mts cases (valid covers, unknown id), scenarios.check.mts for the seed formatter (`seedSteps`).

**Out of scope:** the coverage warning UI (T192).

## Files
- `src/lib/plan.ts`, `src/lib/plan.check.mts`, `src/lib/scenarios.ts`, `src/lib/scenarios.check.mts`
- `src/lib/core.ts` (`applyPlan`, `PlanContext`)
- the plan card component in the chat (`src/components/chat/…`, find where `kind: 'breakdown'` renders)
- `skills/epic-breakdown/SKILL.md`

## Acceptance criteria
- [ ] Accepting a breakdown plan with `covers: ["S1","S2"]` creates a task with `**Covers:** S1, S2` and two seeded checklist steps.
- [ ] A plan with `covers: ["S9"]` is refused with the valid ids.
- [ ] Plans without covers behave exactly as today.

## Verify
```bash
node src/lib/plan.check.mts && node src/lib/scenarios.check.mts
pnpm lint && pnpm build
```
