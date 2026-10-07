# T384: /vibedoc:work runs the docs check; epic Done-when
**Status:** ✅ Done
**Phase:** R088 — Docs quality gate
**Size:** S (~1 hr)
**Depends on:** T380, T382, T383
**Covers:** S1

## Goal
An agent working an epic runs `vibedoc_check_docs` before it marks a docs task done, and R088's Done-when is proven on this repo.

## Context
- Epic: `plans/roadmap/R088-docs-quality-gate.md`
- The skill lives in `plugin/skills/work/SKILL.md` (Verify step).

## Scope
- [ ] work skill: in Verify, "if the task changed any .md, call `vibedoc_check_docs { path }` for each changed file and fix its errors before done".
- [ ] Done-when on this repo: lint broken-link count = graph broken count; searching a doc's title returns it first.
- [ ] MEMORY.md "Key conventions" bullet for R088; epic `**Status:** done`.

## Files
- `plugin/skills/work/SKILL.md`, `memory/MEMORY.md`, `plans/roadmap/R088-docs-quality-gate.md`

## Acceptance criteria
- [ ] Skill text names the tool and when to call it.
- [ ] Done-when checks pass.

## Verify
```bash
pnpm lint && pnpm build
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [ ] S1 — WHEN an agent calls `vibedoc_check_docs` → THEN it gets every doc issue grouped by file with level, rule and line, and a clean project says so in one line
- [ ] Read plugin/skills/work/SKILL.md step 4 (Verify) → it tells the agent to call `vibedoc_check_docs { path }` for each changed .md and fix its errors before done
- [ ] On this repo `vibedoc_check_docs` → 0 errors, the same 45 stale paths /graph shows, plus orphan-doc and no-h1 warnings
- [ ] Search /docs for "Domain Map" → DOMAIN_MAP.md is first
### Regression risk
- [ ] `/vibedoc:work` on an epic without doc changes still runs as before (the check only applies to tasks that changed .md files)
