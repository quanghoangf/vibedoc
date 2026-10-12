# T519: Agent skills write visually; docs page; close R096
**Status:** 📋 Todo
**Phase:** R096 — Visual docs
**Size:** M (2–3 hrs)
**Depends on:** T513, T516
**Covers:** S6

## Goal
Agents add the right visual when they write: `/vibedoc:roadmap`, `/vibedoc:breakdown` and `/vibedoc:work` tell the agent when a flow, states, steps, a comparison or a timeline deserves a Mermaid diagram or a visual block, which type to pick, and to keep it small. The syntax is documented for users, and the epic's Done-when is proven end to end.

## Context
- Epic: `plans/roadmap/R096-visual-docs.md`
- Skills live in `plugin/skills/{roadmap,breakdown,work}/SKILL.md` (the chat reads roadmap + breakdown via `readPlanningSkill()`); keep `plugin/.claude-plugin/plugin.json` `version` = package.json `version` (don't bump it here — semantic-release does).
- Type-picking guidance adapted from cathrynlavery/diagram-design (MIT; credit it in the skill text): pick by the question the reader asks — order of steps → steps/flowchart, who calls whom → sequence, lifecycle → state, data shape → ER, options → compare, dates/phases → timeline; ≤ 7 nodes for a quick read (≤ 12 max), one accent for what matters, never decorate prose that is already short.
- Put the shared guidance once in `plugin/skills/work/visuals.md` and link it from the three skills (progressive disclosure: they read it only when writing docs/tasks), so the three SKILL.md files grow by a few lines each.
- Users' docs: `site/src/content/docs/docs/concepts/` (Starlight) — add `visual-docs.md`; `pnpm --dir site test` must pass.

## Scope
- [ ] `plugin/skills/work/visuals.md` — new: when to visualise, type picker (a table), the visual-block syntax, size and accent rules, "text stays the source of truth" (no HTML/SVG files)
- [ ] `roadmap`, `breakdown`, `work` SKILL.md: a short "Visualise" step pointing to it (breakdown: a task with a flow/state gets a diagram in its Context; work: docs it writes/changes)
- [ ] `site/.../concepts/visual-docs.md` — new; the four blocks + Mermaid, with a GitHub-view note
- [ ] `e2e/visual-docs.mjs` Done-when section: one doc with a diagram and all four blocks renders in light and dark at 390px without page overflow, and `vibedoc_read_doc` (POST /api/mcp) returns the plain lists + mermaid fence
- [ ] Mark R096 done when every task is done (`**Status:** done`)

**Out of scope:** a separate `/vibedoc:diagram` skill, doc-lint "too much text" rule.

## Files
- `plugin/skills/work/visuals.md` — new; `plugin/skills/{roadmap,breakdown,work}/SKILL.md`
- `site/src/content/docs/docs/concepts/visual-docs.md` — new
- `e2e/visual-docs.mjs`, `plans/roadmap/R096-visual-docs.md`

## Acceptance criteria
- [ ] A fresh `/vibedoc:breakdown` on an epic with a multi-step flow (try it via `claude --plugin-dir ./plugin`) produces a task containing a fitting diagram or visual block
- [ ] Site builds and its tests pass; the new page renders the examples as code
- [ ] e2e Done-when section passes

## Verify
```bash
pnpm --dir site test
pnpm build
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/visual-docs.mjs
```

## Manual tests
### Steps
- [ ] S6 — WHEN an agent runs `/vibedoc:breakdown` or `/vibedoc:work` on work with a flow, states or steps → THEN the task or doc it writes contains a fitting diagram or visual block instead of only prose
