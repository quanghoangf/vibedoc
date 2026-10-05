# T191: Breakdown seeds each task's Manual tests from its scenarios
**Status:** 👀 Review
**Phase:** R068 — Scenarios as acceptance tests
**Size:** M (2–3 hrs)
**Depends on:** T190
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

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

## Manual tests
_2026-10-05 — ai · Spec: `e2e/vibedoc/T191-breakdown-seeds-checklists.spec.ts` · Auto: passed 2026-10-05_
### Steps
- [x] 🤖 Ask the agent for a breakdown whose first task covers S1 and S2 → the plan card row reads "covers S1, S2" and the other row has no covers
- [ ] Accept a breakdown plan for an epic with `## Scenarios` S1–S2 where one task has covers S1, S2 → that task file has `**Covers:** S1, S2` and a `## Manual tests` with the steps "S1 — WHEN … → THEN …" and "S2 — …"; it shows 🧪 0/2 on its card
- [ ] Ask the agent to propose a plan with covers ["S9"] → the chat shows the refusal "covers "S9" is not a scenario of R0xx (valid: S1, S2)"
- [ ] Run /epic-breakdown on an epic without `## Scenarios` → the agent offers to write scenarios from "Done when" first
### Regression risk
- [ ] Accepting a plan without covers creates the same task files as before (no Covers line, no Manual tests section)
