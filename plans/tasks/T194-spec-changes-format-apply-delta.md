# T194: "## Spec changes" format and pure applyDelta
**Status:** 👀 Review
**Phase:** R069 — Spec changes on epics
**Size:** M (2–3 hrs)
**Depends on:** T181
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
An epic can say exactly how it changes a capability spec, and VibeDoc can compute the spec after that change. This is OpenSpec's delta, kept in the epic body instead of a separate change folder.

## Context
- Epic: `plans/roadmap/R069-spec-changes-on-epics.md`. Research: `02-research/sdd-openspec.md` (delta + archive).
- Capability specs (R066/T181): `docs/specs/<capability>.md`, `### Requirement: <name>` blocks parsed by `parseSpec()` in `src/lib/specs.ts`. Put the delta code in the same file (pure libs can't import each other).
- Naming: "capability spec", never just "spec" in UI text (`Spec:` in manual tests means a Playwright file).

## Scope
- [ ] Format in the epic body:
  ```
  ## Spec changes
  ### memory
  #### ADDED Requirement: Entry expiry
  The system SHALL …
  ##### Scenario: …
  #### MODIFIED Requirement: Session budget
  <full new requirement text and scenarios>
  #### REMOVED Requirement: Legacy index
  <reason>
  #### RENAMED Requirement: Recall → Keyword recall
  ```
- [ ] `parseSpecChanges(body)` → `{ capability, ops: { op, name, newName?, text }[] }[]`.
- [ ] `applyDelta(specRaw | null, ops)` → `{ raw, errors }`: ADDED appends (error if the name exists), MODIFIED replaces the whole requirement block, REMOVED deletes it, RENAMED changes the heading; MODIFIED/REMOVED/RENAMED on a missing name → error. `null` spec + only ADDED → a new spec with an H1 from the capability. Text outside requirement blocks is kept byte-for-byte.
- [ ] Heading levels: in the epic a requirement is `####` and its scenarios `#####`; in the spec they are `###` / `####` (T181's `parseSpec`). `applyDelta` shifts every heading of an inserted block up one level, and the check asserts the merged spec parses with `parseSpec`.
- [ ] Self-check cases for each op, each error, fences, and a new-spec case.

**Out of scope:** UI and writing files (T195), drift (T196).

## Files
- `src/lib/specs.ts`, `src/lib/specs.check.mts`

## Acceptance criteria
- [ ] All ops round-trip in `specs.check.mts`; applying the same delta twice reports errors instead of duplicating.
- [ ] A requirement block ends at the next `### ` heading or EOF, so scenarios move with their requirement.

## Verify
```bash
node src/lib/specs.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Read the "Spec changes on epics" comment block at the end of src/lib/specs.ts → the format matches the R069 epic (ADDED / MODIFIED / REMOVED / RENAMED, `####` requirement and `#####` scenario in the epic)
- [ ] Spot-check the self-check cases in specs.check.mts against how you expect a merge to read (MODIFIED replaces the whole block incl. scenarios; ADDED lands after the last requirement; outside text untouched)
### Regression risk
- [ ] vibedoc_get_spec / vibedoc_list_specs on docs/specs/memory.md still return the same requirements as before
