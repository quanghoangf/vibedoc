# T198: Pure OpenSpec reader: openspec/ layout → draft epics, tasks and specs
**Status:** 📋 Todo
**Phase:** R070 — OpenSpec import
**Size:** M (2–3 hrs)
**Depends on:** T181

## Goal
VibeDoc understands an OpenSpec repo's files well enough to turn them into its own epics, tasks and capability specs. Risky part first: the real format, tested against the OpenSpec repo itself.

## Context
- Epic: `plans/roadmap/R070-openspec-import.md`. Research: `02-research/sdd-openspec.md`.
- OpenSpec layout (check against the fixture, the docs may lag): `openspec/specs/<capability>/spec.md`; `openspec/changes/<change-id>/{proposal.md, design.md?, tasks.md, specs/<capability>/spec.md}` where change specs are deltas (`## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements` / `## RENAMED Requirements` with `### Requirement:` blocks); archived changes in `openspec/changes/archive/YYYY-MM-DD-<change-id>/`. `tasks.md` = `## 1. Group` headings with `- [ ] 1.1 …` checkboxes.
- Pure lib, no fs: core passes `{ path: raw }` for every file under `openspec/`. Pure libs never import values from each other (no `specs.ts` import; T199 converts deltas through core).

## Scope
- [ ] `src/lib/openspec.ts`: `readOpenSpec(files)` → `{ specs: { capability, raw }[], changes: { id, archived, date?, title, why, whatChanges, design?, groups: { title, items: { text, done }[] }[], deltas: { capability, ops: { op, name, newName?, text }[] }[] }[] }`. Title = proposal H1 or the id humanised.
- [ ] `toVibeDoc(change)` → draft epic `{ title, body, status }` (body: why + what changes, `**Source:** openspec:<id>` in the meta) and draft tasks (one per `## N.` group; items become the Scope checklist; done when every item is checked).
- [ ] Fixture: copy a few real files from github.com/Fission-AI/OpenSpec (`openspec/specs/…`, one open change, one archived) into `src/lib/openspec-fixtures/` (MIT; keep the license note).
- [ ] `src/lib/openspec.check.mts` over the fixture.

**Out of scope:** writing anything (T199), Spec Kit / Kiro formats.

## Files
- `src/lib/openspec.ts`, `src/lib/openspec.check.mts`, `src/lib/openspec-fixtures/`: new

## Acceptance criteria
- [ ] The check parses the fixture: the right number of specs, open and archived changes, groups and checked items.
- [ ] Unknown files under `openspec/` are ignored, not errors.

## Verify
```bash
node src/lib/openspec.check.mts
pnpm lint && pnpm build
```
