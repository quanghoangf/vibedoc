# T123: Section merge in vibedoc_update_memory
**Status:** 📋 Todo
**Phase:** R045 — Safe memory updates
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
An agent's `vibedoc_update_memory` rewrites only the sections it passes. Every other section stays where it is, including hand-written ones the template doesn't know about, such as "Key conventions" in this repo's MEMORY.md. This covers the epic's first Done-when: an agent's handoff leaves a hand-written section untouched.

## Context
- Epic: `plans/roadmap/R045-safe-memory-updates.md`
- Today `updateMemory()` (`src/lib/core.ts:931`) rebuilds the whole file from a template literal, so unknown sections are lost.
- Decided: a field that is passed replaces its section's body (lists too, no appending). A field that is left out keeps its section as it is. No field is required any more, but a call with zero known fields is an error.
- Heading names must stay the same, because other code depends on them. `src/lib/memory-health.ts` matches `## Working on now`, `## Up next` and `## Just completed`, and R050 `episodesSinceHandoff` uses the mtime of MEMORY.md.
- Project rules: only `core.ts` touches fs. Pure libs never import values from each other: `memory-health.ts` already has `splitSections()`, so either copy that logic or move it, and don't import across libs.

## Scope
- [ ] `src/lib/memory-sections.ts` (new, pure):
  - [ ] `parseMemory(md)` → `{ preamble, sections: { heading, body }[] }`, lossless. Joining the result back gives the input byte for byte. `## ` lines inside ``` fences are not headings.
  - [ ] `mergeMemory(current, params, stamp)` → the new markdown.
- [ ] Merge rules:
  - [ ] Each passed field renders with the existing format (bullets, numbered list, issues table, the "(nothing …)" placeholders) and replaces the body of the section with the same heading, matched case-insensitively.
  - [ ] When a passed section is missing from the file, append it in template order, after the last known section that comes before it.
  - [ ] Unknown sections and their order stay untouched.
  - [ ] Replace the `**Last updated:**` line in the preamble, or insert it under the H1.
  - [ ] An empty or missing file renders the full template, as today.
- [ ] `updateMemory()` reads the current file, calls `mergeMemory`, then writes the result.
  - [ ] Throw `Nothing to update: pass at least one of …` when no known field is given.
  - [ ] The activity detail is `handoff.slice(0,120)` when a handoff was passed, otherwise it lists the sections that were updated.
- [ ] MCP `vibedoc_update_memory`:
  - [ ] Change `required` to `[]`.
  - [ ] Description: "Only the sections you pass are rewritten; other sections (including hand-written ones) are kept."
  - [ ] Return the error text on an empty call.
- [ ] `POST /api/memory` returns 400 with the error message on an empty call.
- [ ] `src/lib/memory-sections.check.mts`.

**Out of scope:** snapshots and restore (T124), the MCP history tool (T125), the UI (T126), docs and e2e (T127).

## Files
- `src/lib/memory-sections.ts`, `src/lib/memory-sections.check.mts`: new
- `src/lib/core.ts`: `MemoryParams` (all fields optional) and `updateMemory()`
- `src/app/api/mcp/route.ts`: the `vibedoc_update_memory` schema, description and case
- `src/app/api/memory/route.ts`: catch the error and return 400

## Implementation notes
- Move the per-section renderers out of the current template literal into `memory-sections.ts` as a `SECTIONS` table: `[key, heading, render(value)]`. The `MemoryParams` key → heading mapping is then defined in exactly one place.
- Keep `MemoryParams` as an exported type in core, or define it in `memory-sections.ts` and have core re-export it.
- Build `stamp` (`YYYY-MM-DD at HH:MM`) in core. The pure lib never calls `new Date()`, so the check stays deterministic.

## Acceptance criteria
- [ ] A MEMORY.md with a `## Key conventions` section between two template sections: `vibedoc_update_memory { handoff: "x" }` changes only `## Handoff for next session` and `**Last updated:**`; everything else is byte-identical.
- [ ] `vibedoc_update_memory {}` → error text and the file is unchanged.
- [ ] A missing MEMORY.md plus `{ currentState, handoff }` → the same full template as before this task.
- [ ] A `## Up next` line inside a ``` fence of another section is not treated as a heading.
- [ ] `node src/lib/memory-sections.check.mts` passes, and the existing `memory-health.check.mts` and `episodes.check.mts` still pass.

## Verify
```bash
node src/lib/memory-sections.check.mts && node src/lib/memory-health.check.mts && node src/lib/episodes.check.mts
pnpm lint && pnpm build
curl -s localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_update_memory","arguments":{"handoff":"test"}}}'
git diff memory/MEMORY.md   # only the handoff + Last updated lines change
```
