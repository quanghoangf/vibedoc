# T384: /vibedoc:work runs the docs check; epic Done-when
**Status:** 📋 Todo
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
