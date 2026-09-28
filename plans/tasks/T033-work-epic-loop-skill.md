# T033: /work-epic loop skill
**Status:** ✅ Done
**Phase:** R037 — Agent work queue
**Size:** S (~1 hr)
**Depends on:** T031

## Goal
`/work-epic R037` makes Claude Code work through an epic by itself: claim the next task, implement it, verify it, mark it done, repeat. It stops cleanly when the epic is finished or needs a human. This meets the epic's "Done when": an agent given only an epic id completes its tasks.

## Context
- Epic: `plans/roadmap/R037-agent-work-queue.md`
- Skills ship in this repo under `skills/` (see `skills/roadmap-planner/SKILL.md` and `skills/epic-breakdown/SKILL.md` for tone and structure). They're symlinked into `~/.claude/skills/`.
- Tool contract from T030/T031: `vibedoc_next_task { epic }` returns one of three messages: `🔨 Claimed …` with the full task, `⏳ Nothing ready …` with reasons, or `✅ Epic … is finished`.

## Scope
- [ ] `skills/work-epic/SKILL.md`: frontmatter (`name`, a pushy `description` naming the triggers: "work on epic", "implement R037", "keep going on the epic"), then the loop
- [ ] The loop: next_task → read the task's Goal, Files, Acceptance criteria and Verify → implement → run the task's **Verify** commands → on pass, `vibedoc_update_task done` and commit (following the repo's commit rules) → next_task again
- [ ] Stop rules: `finished` → report and stop. `waiting` with "Needs a human" → report the reasons and stop. `waiting` on in-progress tasks only → report and stop, because another agent owns them
- [ ] Failure rule: if Verify fails and can't be fixed within the task's scope, set the task to `blocked`, append a short "Blocked because" note to the task file, and stop. Don't mark it done
- [ ] Symlink: `ln -s "$PWD/skills/work-epic" ~/.claude/skills/work-epic`

**Out of scope:** verification gates and human review (R043), and running several epics at once.

## Files
- `skills/work-epic/SKILL.md`: new

## Implementation notes
- Explain the why in the skill, not only the rules. For example, each task leaves the app working, so committing after each task makes it safe to stop at any point.
- Tell the agent to read `CLAUDE.md` once at the start. Task files quote the rules, but the project's commands and bans live there.
- Keep it under ~80 lines. The task files carry the detail, and the skill is only the loop.

## Acceptance criteria
- [ ] Running `/work-epic R002` against the T030 fixture claims T001, then T002, and ends with "finished". The fixture tasks have no real work, so a no-op implementation counts
- [ ] With T002 set to `blocked`, the run stops after T001 and reports "Needs a human"
- [ ] The skill never marks a task done when its Verify failed

## Verify
```bash
ls -l ~/.claude/skills/work-epic/SKILL.md
# In a Claude Code session with the VibeDoc MCP pointed at the fixture (?root=<fixture>):
#   /work-epic R002   → watch the board: T001 then T002 move to done, and the run ends with "finished"
```
