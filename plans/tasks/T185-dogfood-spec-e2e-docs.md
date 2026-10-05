# T185: Dogfood one capability spec, e2e and docs
**Status:** 👀 Review
**Phase:** R066 — Living capability specs
**Size:** M (2–3 hrs)
**Depends on:** T182, T184
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
R066 is proven on VibeDoc itself: one real capability has a reviewed spec, its epic points at it, and an agent claiming a task there sees the requirements.

## Context
- Epic: `plans/roadmap/R066-living-capability-specs.md`. "Done when": for one existing capability, a reviewed spec exists and an agent claiming a task in that area sees its requirements without being told where to look.
- Capability: project memory (knowledge entries, recall, browser, safe updates, graph). Its history is spread over R045, R046, R047, R048, R053 and their done tasks, which is exactly the "rebuild it from old tasks" problem specs fix. (Board views were considered but have no epic of their own.)

## Scope
- [ ] Draft `docs/specs/memory.md` with `vibedoc_spec_context` + `vibedoc_propose_edit`. Requirements are observable behaviour (save/recall/restore, budgets, Undo), not code. Leave it for human review in the manual tests.
- [ ] Add `**Specs:** memory` to R045, R046, R047, R048 and R053 (via `vibedoc_update_roadmap_item`).
- [ ] `e2e/specs.mjs` (follow `e2e/memory-browser.mjs` for setup), in a temp fixture project:
  - Create a spec from the template in /docs → the Capability spec chip shows; /graph lists it as a capability spec.
  - An epic with `**Specs:**` + a task → MCP `vibedoc_get_task` contains `## Related spec` with the requirement names.
  - `vibedoc_get_spec` returns one requirement.
  - Clean up in `finally`.
- [ ] Docs: CLAUDE.md repo structure (docs/specs) and "VibeDoc writes" list if anything new is written; MEMORY.md "Key conventions" line for specs (path, format, **Specs:**, Related spec, the check command); HLD component list (`listSpecs`, `relatedSpecs`, `getSpecContext`).
- [ ] Mark R066 done when the "Done when" holds.

**Out of scope:** specs for other capabilities, scenarios → manual tests (R068), spec deltas (R069).

## Files
- `docs/specs/memory.md`: new
- `plans/roadmap/R045/R046/R047/R048/R053-*.md`: `**Specs:**` line
- `e2e/specs.mjs`: new
- `CLAUDE.md`, `memory/MEMORY.md`, `docs/architecture/02-high-level-design/HLD.md`

## Acceptance criteria
- [ ] `docs/specs/memory.md` exists, each requirement has at least one scenario, and a human has reviewed it (manual test item).
- [ ] `vibedoc_next_task` for a task under R047 (or a new memory task) shows `## Related spec`.
- [ ] `node e2e/specs.mjs` passes.

## Verify
```bash
node src/lib/specs.check.mts && node src/lib/doc-links.check.mts
pnpm lint && pnpm build
node e2e/specs.mjs
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Open /docs → docs/specs/memory.md shows the Capability spec chip; read it and confirm every requirement matches how memory behaves today (fix or delete any that don't) — this is the human review the epic's Done-when needs
- [ ] Each requirement in docs/specs/memory.md has at least one WHEN/THEN scenario
- [ ] Open /graph → memory.md is drawn as a hexagon under "Capability specs"
- [ ] Ask an agent to call vibedoc_get_task T090 (R047) → the reply ends with `## Related spec` listing the memory requirements, without being told where to look
- [ ] R045, R046, R047, R048 and R053 each have exactly one new `**Specs:** memory` line and nothing else changed
### Regression risk
- [ ] /roadmap still opens those five epics and their sheets show the same title, status and tasks
