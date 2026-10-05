# T186: Verification findings: "## Verification" section, report tool, task panel
**Status:** 📋 Todo
**Phase:** R067 — Spec verification review
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
An agent can record what a finished task gets wrong against what was asked, and the human sees those findings on the task before deciding. Thin slice: findings go in and show up; producing them well is T187.

## Context
- Epic: `plans/roadmap/R067-spec-verification-review.md`. Different from R062 (human reviews evidence) and R063 (are the *tests* honest): this checks the *code* against the task's criteria.
- Decision: findings live in the task file, in a `## Verification` section after `## Manual tests` / before `## Review`, the same way `src/lib/review.ts` and `src/lib/manual-tests.ts` keep their sections. A new report replaces the old one. Both existing sections are bounded "heading → next `## ` heading or EOF" (`manual-tests.ts` section range), so a middle slot is safe as long as the new parser uses the same bound; `addReviewEntry` creates `## Review` at the end when missing, so write Verification before an existing Review, else append.
- Rules: pure libs never import values from each other; only `core.ts` touches fs; call `emitUpdate()` after the mutation in the route / MCP case.
- Build on `main` (this branch is behind it).

## Scope
- [ ] `src/lib/verification.ts` (pure): format/parse the section.
  ```
  ## Verification
  _2026-10-06 — ai:claude-code · at 3f2a91c_
  - [critical] AC2 "Unknown plan → 400" — route returns 500 · `src/app/api/checkout/route.ts:41`
  - [minor] Scope "update the stale comment" — comment still says R060
  ```
  Type: `{ at, by, sha?, findings: { severity: 'critical'|'major'|'minor', criterion, message, file?: string }[] }`. An empty findings list = "verified, nothing found" (keep the header line). Ignore headings inside ``` fences.
- [ ] `src/lib/verification.check.mts`.
- [ ] core `saveVerification(taskId, report, root, agent)` (follow `saveManualTests()`), `Task.verification` parsed on read.
- [ ] MCP `vibedoc_report_findings { taskId, findings, sha? }` → validates severity/criterion, saves, emits `task_updated`.
- [ ] Task panel (`TaskDetailPanel.tsx`): a Verification block grouped by severity, file refs as `code`; card shows a small badge with the critical+major count.

**Out of scope:** gathering context and the Verify button (T187), send back / outdated (T188).

## Files
- `src/lib/verification.ts`, `src/lib/verification.check.mts`: new
- `src/lib/core.ts`, `src/app/api/mcp/route.ts`
- `src/components/board/TaskDetailPanel.tsx`, `src/components/board/TaskCard.tsx`

## Acceptance criteria
- [ ] `vibedoc_report_findings` with two findings → the task file gains the section, the panel shows them live (SSE).
- [ ] A second report replaces the first; other sections of the file are byte-for-byte unchanged.
- [ ] Invalid severity → JSON-RPC error naming the allowed values.

## Verify
```bash
node src/lib/verification.check.mts
pnpm lint && pnpm build
```
