# T189: Verification review e2e and docs
**Status:** 👀 Review
**Phase:** R067 — Spec verification review
**Size:** M (2–3 hrs)
**Depends on:** T187, T188
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
R067's "Done when" is proven by a test: a task finished with one acceptance criterion skipped gets a finding naming it, and sending it back reaches the agent.

## Context
- Epic: `plans/roadmap/R067-spec-verification-review.md`.
- e2e style: `e2e/manual-tests-review.mjs` (fixture project, MCP over HTTP, Playwright for the UI, cleanup in `finally`). The agent's judgement isn't tested; the test plays the agent by calling the MCP tools.

## Scope
- [ ] `e2e/verification.mjs`, in a temp git repo fixture:
  - Task with two acceptance criteria and one commit `(T001)`.
  - `vibedoc_verify_context` includes both criteria and the commit diff.
  - `vibedoc_report_findings` with a critical finding on AC2 → panel shows it, card badge shows 1.
  - Send back → `vibedoc_next_task` starts with the finding.
  - New commit `(T001)` → finding shows outdated.
- [ ] Docs: CLAUDE.md (task `## Verification` in the "VibeDoc writes" list), MEMORY.md "Key conventions" line (section format, tools, outdated rule, checks), `docs/architecture/mcp-tools.md`, HLD component list.
- [ ] Mark R067 done when the "Done when" holds.

## Files
- `e2e/verification.mjs`: new
- `CLAUDE.md`, `memory/MEMORY.md`, `docs/architecture/mcp-tools.md`, `docs/architecture/02-high-level-design/HLD.md`

## Acceptance criteria
- [ ] `node e2e/verification.mjs` passes.
- [ ] Docs describe the section and both tools.

## Verify
```bash
node src/lib/verification.check.mts
pnpm lint && pnpm build
node e2e/verification.mjs
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] On this repo, click Verify on a real task in review (e.g. T186) → the agent chat reads the context, and the task gains a Verification block with findings or "Verified: nothing found."
- [ ] Read the Verification part of docs/architecture/mcp-tools.md → it matches what the panel shows (section format, send back, outdated)
- [ ] MEMORY.md has a "Verification review (R067)" Key conventions line and CLAUDE.md lists `## Verification` among what VibeDoc writes
### Regression risk
- [ ] Approve / Send back with a note on /manual-tests still work for a task that has no Verification section
