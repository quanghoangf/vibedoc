# T039: Plan kind "roadmap" — horizons + epics
**Status:** ✅ Done
**Phase:** R040 — Planning from the chat sidebar
**Size:** M (2–3 hrs)
**Depends on:** T036

## Goal
The agent can propose a roadmap (new horizons and epics, or epics added under existing horizons) with `vibedoc_propose_plan`. The user previews it as a tree, unchecks what they don't want, and Accept writes the roadmap items. This covers the "empty roadmap" half of the epic's "Done when".

## Context
- Epic: `plans/roadmap/R040-planning-from-the-chat-sidebar.md`
- Shapes come from T035 (`src/lib/plan.ts`): `{ kind: 'roadmap', horizons: PlanHorizon[], epics: PlanEpic[] }`. An epic's `parent` is either an existing horizon id (`R002`) or the key of a new horizon in the plan.
- The roadmap has max depth 2: a horizon has no parent, and an epic's parent must be a horizon (`validateParent` in `core.ts`). Positions live only in `layout.json`; items without an entry are auto-placed. Don't write positions.
- Roadmap writes go through `createRoadmapItem()`, which already runs under `withRoadmapLock`.

## Scope
- [ ] `validatePlan` / `selectPlan` for `roadmap`:
  - keys are unique
  - each epic's parent is an existing horizon (not an epic) or a horizon key in the plan
  - an unchecked horizon with checked epics under it is an error
  - epic titles don't duplicate existing items in the same horizon (case-insensitive)
- [ ] `applyPlan` for `roadmap`: create the horizons first and map their keys to ids, then the epics with their resolved parent. New horizons' `order` continues after the last existing horizon in steps of 10; epics within a horizon likewise. Status defaults to `planned`.
- [ ] `PlanCard`: for `roadmap`, render a tree (horizon → epics). Checking a horizon toggles its epics. Each epic row shows its one-line outcome (the first line of its body) and expands to the full body.
- [ ] The route emits `roadmap_updated` once after the apply
- [ ] Extend `plan.check.mts` with the roadmap cases

**Out of scope:** reordering or editing existing roadmap items, layout positions.

## Files
- `src/lib/plan.ts`, `src/lib/plan.check.mts`
- `src/lib/core.ts`: the `roadmap` branch of `applyPlan()`
- `src/components/chat/PlanCard.tsx`: the tree view
- `src/app/api/plan/apply/route.ts`: the event for the roadmap kind

## Implementation notes
- Epic body format is the one `roadmap-planner` writes: one outcome sentence, a blank line, then `**In scope:**`, `**Out of scope:**` and `**Done when:**`. `createRoadmapItem` writes the body after the meta block with a blank line, so these lines stay out of the meta (see `roadmapMetaEnd`).
- Reuse T036's row and checkbox components rather than building a second list.

## Acceptance criteria
- [ ] On an empty fixture, a plan with 2 new horizons and 3 epics creates R001–R005 with correct parents, and they appear on `/roadmap` live
- [ ] A plan that adds 1 epic under an existing horizon `R002` creates it with `**Parent:** R002` and an order after R002's last epic
- [ ] Unchecking a horizon unchecks its epics. Unchecking only the horizon, while keeping an epic checked, is impossible or errors clearly.
- [ ] An epic whose parent is an existing epic (depth 3) fails validation with a clear message
- [ ] `node src/lib/plan.check.mts` passes with the new cases, and lint adds no new errors

## Verify
```bash
node src/lib/plan.check.mts
pnpm build && pnpm lint
FX=$(mktemp -d) && mkdir -p $FX/plans/roadmap
PLAN='{"kind":"roadmap","horizons":[{"key":"h1","title":"Now"},{"key":"h2","title":"Next"}],"epics":[{"key":"e1","title":"Billing","parent":"h1","body":"Pay.\n\n**In scope:** x\n**Out of scope:** y\n**Done when:** z"},{"key":"e2","title":"Teams","parent":"h2","body":"T."}]}'
curl -s "localhost:3000/api/plan/apply?root=$FX" -H 'content-type: application/json' -d "{\"plan\":$PLAN,\"selected\":[\"h1\",\"h2\",\"e1\",\"e2\"]}"; echo
head -5 $FX/plans/roadmap/*.md
```
