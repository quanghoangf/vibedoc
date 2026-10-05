# T181: Spec format: parser, 'spec' kind in docs and graph, template
**Status:** 📋 Todo
**Phase:** R066 — Living capability specs
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
A capability spec is a recognised kind of doc: the user creates one from a template, it reads as a spec in /docs and /graph, and VibeDoc can parse its requirements and scenarios. Every later R066 task builds on this parser.

## Context
- Epic: `plans/roadmap/R066-living-capability-specs.md`. Research: `02-research/sdd-openspec.md`.
- Decisions: specs live at `docs/specs/<capability>.md` (one file per capability, slug = capability id). They are recognised **by path**, like tasks and entries in `docNode()`.
- Format follows OpenSpec headings but nothing is mandatory: `### Requirement: <name>` with a SHALL/MUST sentence, then `#### Scenario: <name>` with `- WHEN …` / `- THEN …` bullets. A file with no requirements is still a spec; it just has nothing to match.
- Rules: pure libs never import values from each other (`node *.check.mts` runs without a bundler). Only `core.ts` touches fs.
- Base this on `main` (it is 33 commits ahead of `spartan-hoangnguyen/research-sdd`; `core.ts` differs).

## Scope
- [ ] `src/lib/specs.ts` (pure): `parseSpec(path, raw)` → `{ capability, title, purpose, requirements: [{ name, text, scenarios: [{ name, text }] }] }`. Ignore headings inside ``` fences (as the manual-tests / review parsers do). `isSpecPath(p)` for `docs/specs/<slug>.md` (no subfolders).
- [ ] `src/lib/specs.check.mts`: parse a full spec, one with no requirements, a requirement with no scenario, headings inside a fence, a non-spec path.
- [ ] `docNode()` in `src/lib/doc-links.ts`: `docs/specs/*.md` → `kind: 'spec'`, `id` = the path, label = H1. Add `'spec'` to `DocNodeKind` and to `GRAPH_DEFAULT_KINDS`.
- [ ] /graph: `KINDS`, `KIND_NAME` in `src/components/graph/DocGraph.tsx`, an icon in `KIND_ICON` (`src/components/memory/EntryRelated.tsx`). Follow DESIGN.md "Doc Link Graph": shape = kind.
- [ ] Template "Capability spec" (`src/lib/templates/technical.ts` or a new `process` entry), `defaultPath: docs/specs/<capability>.md`, with a Purpose paragraph, one example requirement and one example scenario.
- [ ] UI label is **"Capability spec"** everywhere (graph kind filter, KIND_NAME, chip, template), never bare "Spec": `Spec:` in manual tests already means a Playwright `.spec.ts` file.
- [ ] /docs list: a small "Capability spec" chip on spec files (`src/components/docs/DocList.tsx`).

**Out of scope:** related spec for agents (T182), MCP spec tools (T183), strict validation.

## Files
- `src/lib/specs.ts`, `src/lib/specs.check.mts`: new
- `src/lib/doc-links.ts`, `src/lib/doc-links.check.mts`: the new kind
- `src/components/graph/DocGraph.tsx`, `src/components/memory/EntryRelated.tsx`
- `src/lib/templates/*.ts`, `src/components/docs/DocList.tsx`

## Implementation notes
- Copy the fence-skipping loop from `src/lib/manual-tests.ts`; don't import it.
- Check every `Record<DocNodeKind, …>` (TypeScript will flag them) so the new kind has a label and icon everywhere.
- Shape for later tasks: `type SpecRequirement = { name: string; text: string; scenarios: { name: string; text: string }[] }`.

## Acceptance criteria
- [ ] New doc → "Capability spec" → `docs/specs/board-views.md` is created and shows the Capability spec chip in /docs.
- [ ] /graph shows it with the spec shape and lists "Capability spec" in the kind filter.
- [ ] `node src/lib/specs.check.mts` and `node src/lib/doc-links.check.mts` pass.
- [ ] A doc outside `docs/specs/` with the same headings stays kind `doc`.

## Verify
```bash
node src/lib/specs.check.mts && node src/lib/doc-links.check.mts
pnpm lint && pnpm build
```
