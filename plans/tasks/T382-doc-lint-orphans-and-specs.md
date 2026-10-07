# T382: Doc lint: orphan docs, capability specs, spec changes
**Status:** ✅ Done
**Phase:** R088 — Docs quality gate
**Size:** S (~1 hr)
**Depends on:** T381
**Covers:** S1

## Goal
The lint also catches docs nobody links to, capability specs that don't parse into requirements, and epic `## Spec changes` that wouldn't merge.

## Context
- Epic: `plans/roadmap/R088-docs-quality-gate.md`
- `parseSpec` (`src/lib/specs.ts`) never throws; its "errors" are structural: no requirements, a duplicate requirement name, a scenario without WHEN/THEN.
- Broken spec changes = the errors `applyDelta` returns for an epic's `parseSpecChanges` against the current spec (as `previewSpecMerge` in core does), for epics not yet `**Spec merged:**`. All pure over the file list; core passes the spec helpers in (pure libs only `import type` each other).

## Scope
- [ ] `orphan-doc` (warn): a `docs/**` file of kind doc / adr / spec with no incoming edge.
- [ ] `spec-structure` (warn): spec with no `### Requirement:`, duplicate requirement name, scenario with no WHEN or THEN bullet; line = the heading.
- [ ] `spec-changes` (error): each `applyDelta` error or invalid capability slug, on unmerged epics; line = the op heading (else the `## Spec changes` line).
- [ ] Cases in `src/lib/doc-lint.check.mts`; mcp-tools.md lists every rule.

**Out of scope:** UI (T383).

## Files
- `src/lib/doc-lint.ts`, `src/lib/doc-lint.check.mts`, `src/lib/core.ts`, `docs/architecture/mcp-tools.md`

## Acceptance criteria
- [ ] An epic MODIFYing a requirement the spec doesn't have → one `spec-changes` error at that heading.
- [ ] A spec with a scenario lacking THEN → `spec-structure` warn.
- [ ] An unlinked `docs/x.md` → `orphan-doc`; once another doc links it, gone.

## Verify
```bash
node src/lib/doc-lint.check.mts
node src/lib/specs.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [ ] S1 — WHEN an agent calls `vibedoc_check_docs` → THEN it gets every doc issue grouped by file with level, rule and line, and a clean project says so in one line
- [ ] Ask the agent to run `vibedoc_check_docs` on this repo → `orphan-doc` warnings for the docs nobody links to (e.g. docs/CONVENTIONS.md)
- [ ] Add `#### MODIFIED Requirement: Ghost` under a planned epic's `## Spec changes` → `spec-changes` error at that heading line; remove it
- [ ] Remove the `- THEN` bullet from a scenario in docs/specs/memory.md → `spec-structure` warning at that scenario's heading; undo
### Regression risk
- [ ] The epic sheet's "Merge into capability spec" preview still shows the same errors as before (it doesn't use the lint)
