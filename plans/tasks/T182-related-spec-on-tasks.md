# T182: "## Related spec" on vibedoc_get_task and vibedoc_next_task
**Status:** 📋 Todo
**Phase:** R066 — Living capability specs
**Size:** M (2–3 hrs)
**Depends on:** T181

## Goal
An agent that reads or claims a task sees the requirements of the capability it is about to change, without being told where to look. This is the epic's main "Done when".

## Context
- Epic: `plans/roadmap/R066-living-capability-specs.md`.
- Decision: an epic may declare `**Specs:** board-views, memory` in its meta block (slugs of `docs/specs/<slug>.md`). Tasks of that epic get those specs. When the epic declares none, fall back to keyword ranking of every requirement.
- `parseRoadmapFile()` in `core.ts` reads any `**Key:** Value` in the head block; `updateRoadmapItemUnlocked()` replaces/inserts meta lines one by one, so an extra `**Specs:**` line survives edits.
- Today `relatedEntries()` (core.ts) appends `## Related memory` in the `vibedoc_get_task` and `vibedoc_next_task` cases of `src/app/api/mcp/route.ts` via `withGap(...)`.

## Scope
- [ ] `RoadmapItem.specs: string[]` parsed from `**Specs:**` (lower-case slugs, comma/space separated, `—` = none).
- [ ] core `listSpecs(root)` → parsed specs from `docs/specs/*.md` (use `parseSpec`). Reuse the doc graph's mtime cache if it is cheap; else read per call (`ponytail:` note with the ceiling).
- [ ] core `relatedSpecs(task, root, limit = 3)`:
  - Epic declares specs → every requirement name of those specs (name only, no body), grouped per spec, max ~15 lines.
  - Else → map each requirement to a `RecallEntry` (`id: "<slug>#<name>"`, `type: 'spec'`, `summary: name`, `body: text + scenarios`) and use `rankEntries()` + `taskQuery()` from `recall.ts`; keep hits with score ≥ the related minimum, top `limit`.
- [ ] `src/lib/specs.ts`: `formatRelatedSpecs(...)` → `## Related spec` block ending with "Read with vibedoc_get_spec" (T183 adds it; until then "vibedoc_read_doc docs/specs/<slug>.md").
- [ ] Append it after Related memory in both MCP cases.

**Out of scope:** the MCP spec tools (T183), UI for **Specs:** (edit the file or use T183's param).

## Files
- `src/lib/core.ts`: `listSpecs`, `relatedSpecs`, `RoadmapItem.specs`
- `src/lib/specs.ts`, `src/lib/specs.check.mts`: formatter + its check
- `src/app/api/mcp/route.ts`: the two cases

## Implementation notes
- Pure libs can't import each other: the ranking is wired in core (it already imports `rankEntries`, `taskQuery`), the formatter is in specs.ts.
- Resolve the task's epic from `task.phase` (`R066 — …`) the way `roadmapHint()` does.

## Acceptance criteria
- [ ] With `docs/specs/board-views.md` and `**Specs:** board-views` on an epic, `vibedoc_get_task` for one of its tasks ends with `## Related spec` listing that spec's requirements.
- [ ] With no `**Specs:**`, a task whose title matches a requirement name gets that requirement; an unrelated task gets no block at all.
- [ ] No spec files in the project → output identical to today.
- [ ] Check covers the formatter (declared, ranked, empty).

## Verify
```bash
node src/lib/specs.check.mts
pnpm lint && pnpm build
```
