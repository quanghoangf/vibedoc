---
name: next
description: Tell the user the single most useful next thing to do in a VibeDoc project, with the exact command to run. Reads the board (plans/tasks), the roadmap (plans/roadmap), the activity log, MEMORY.md's handoff and git state, then recommends one action, e.g. unblock a task, resume an abandoned one, /vibedoc:work on the active epic, /vibedoc:breakdown on the next epic, fix roadmap drift, or /vibedoc:roadmap. Use this whenever the user asks "what should I do next", "what's next", "where was I", "nên làm gì tiếp", "tiếp theo làm gì", starts a session and wants orientation, or seems unsure what to pick up, even if they don't mention the roadmap or tasks.
---

# What next

Answer "what should I do now?" with **one** recommendation and a command the user can run immediately. A list of ten options is not an answer. The user asked because they didn't want to weigh options themselves. Do the weighing, show the reasoning in a line or two, and keep the alternatives short.

This skill only reads. Don't change task or roadmap files, and don't start the recommended work until the user says so.

## 1. Gather the state

Read these, in any order. Prefer the VibeDoc MCP tools when they're connected (`vibedoc_get_status`, `vibedoc_get_roadmap`, `vibedoc_list_tasks`). Otherwise read the files directly. Either way it's cheap, so read everything below before deciding.

- **Tasks:** `plans/tasks/T*.md`. For each: id, title, status, `Depends on`, and `Due` from the `**Key:** Value` block under the H1, plus any `## Verification` findings (critical / major / minor).
- **Roadmap:** `plans/roadmap/R*.md`. Items with no `**Parent:**` are horizons, and items with one are epics. For each epic: status, `**Tasks:**` list, and `Due`. `vibedoc_get_roadmap` also lists "Needs attention" (status drift, overdue, at risk, unmerged spec changes, conflicting spec changes, uncovered scenarios).
- **Activity:** `.vibedoc-activity.json`. You need the last `task_updated` time for each in-progress task, to tell active work from abandoned work.
- **Handoff:** the "Handoff for next session" / "Up next" part of `memory/MEMORY.md`, if it exists. It is the last session's intent. Weigh it, but check it against the files, because it goes stale.
- **Git:** current branch, uncommitted changes, and commits not pushed yet (`git status -sb`, `git log @{u}..` when there is an upstream).

## 2. Pick the first rule that applies

The order runs from "something is stuck or at risk" to "start something new". Unblocking beats starting, because a stuck task holds up everything that depends on it, and starting new work on top of a mess makes the mess bigger.

| # | Situation | Recommend |
|---|---|---|
| 1 | Uncommitted changes, or a branch with unpushed commits, that look like finished work | Commit or push / open a PR (`/commit`, `/create-pr`). Say what the changes are. |
| 2 | A task is `blocked`, or an epic's queue would report "Needs a human" (blocked task, missing task file, broken dependency) | Unblock it: read its `## Blocked because` note if there is one and say what decision is needed. |
| 2b | A task in `review` or `done` has critical or major findings in its `## Verification` (the card shows "N findings"), and they aren't outdated | Send them back from the task panel (tick the findings → **Send back N findings**), or say which finding is wrong if you disagree. Name the task and the findings. |
| 3 | A task is `in-progress` with no activity for more than ~24h | It's probably abandoned: resume it, or move it back to `todo` so the queue can hand it out again. |
| 4 | An epic has ready tasks: `todo`, with every dependency `done` or `cancelled` | `/vibedoc:work <epic>`. Prefer an epic that is already `in-progress`, then the earliest horizon, then by `Order`. Name the task it would start with. |
| 5 | Roadmap drift: all of an epic's tasks are done but the epic isn't, an epic is `planned` while its tasks are moving, or something is overdue | Fix the status or due date (`vibedoc_update_roadmap_item`, or edit the `**Status:**` line). |
| 5b | Spec drift under "Needs attention" in `vibedoc_get_roadmap`: a done epic whose spec changes aren't merged, two open epics changing the same requirement, or a scenario no task covers | Unmerged: **Merge into capability spec** on the epic's sheet (a person does it). Conflict: decide which epic owns the requirement and edit the other's `## Spec changes`. Uncovered scenario: add `**Covers:**` to a task, or a task for it, before work starts. |
| 6 | The earliest horizon has a planned epic with no tasks | `/vibedoc:breakdown <epic>`. Pick the first one by horizon order, then by `Order`. |
| 7 | No roadmap at all (`plans/roadmap/` empty or missing) | `/vibedoc:roadmap`. |
| 8 | Nothing above applies | Say the project is in a clean state, and suggest `/vibedoc:roadmap` to plan the next horizon. |

When the handoff in MEMORY.md names a specific next step that is still valid (the task exists and isn't done), and nothing from rules 1–3 applies, recommend that step. The previous session had context you don't.

## 3. Answer

Reply in the user's language. Keep it to this shape:

```
**Next:** <one sentence: the action>
<command to run, in a code block>

**Why:** <1–2 lines of evidence: ids, statuses, dates you actually read>

**After that:** <at most 3 short bullets, the next rules that also applied>
```

Always use real ids and titles. "R038 Epic & horizon progress has no tasks yet" is useful; "some epics need breakdown" is not. If two situations tie, pick one and mention the other under "After that". Don't ask the user to choose.
