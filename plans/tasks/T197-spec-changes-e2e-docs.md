# T197: Spec changes e2e, docs and planning skills
**Status:** 📋 Todo
**Phase:** R069 — Spec changes on epics
**Size:** S (~1 hr)
**Depends on:** T195, T196

## Goal
The delta flow is tested end to end, and the planning skills write `## Spec changes` so agents produce deltas without being asked.

## Context
- Epic: `plans/roadmap/R069-spec-changes-on-epics.md`.
- Skills: `skills/roadmap-planner/SKILL.md`, `skills/epic-breakdown/SKILL.md`; the chat reads them via `readPlanningSkill()`.

## Scope
- [ ] `e2e/spec-changes.mjs`: fixture with `docs/specs/memory.md` and a done epic MODIFYING one requirement → need-attention shows `spec-unmerged` → sheet Merge → Accept → spec updated, drift gone.
- [ ] Skills: when an epic changes an existing capability that has a spec, write `## Spec changes`; breakdown reads it as scope.
- [ ] Docs: MEMORY.md conventions line (format, merge flow, `**Spec merged:**`, drift kinds), CLAUDE.md "VibeDoc writes" (capability specs on merge, the meta line), HLD.
- [ ] Mark R069 done when the "Done when" holds.

## Files
- `e2e/spec-changes.mjs`: new
- `skills/roadmap-planner/SKILL.md`, `skills/epic-breakdown/SKILL.md`
- `memory/MEMORY.md`, `CLAUDE.md`, `docs/architecture/02-high-level-design/HLD.md`

## Acceptance criteria
- [ ] `node e2e/spec-changes.mjs` passes.

## Verify
```bash
node src/lib/specs.check.mts && node src/lib/roadmap-health.check.mts
pnpm lint && pnpm build
node e2e/spec-changes.mjs
```
