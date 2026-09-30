---
name: work-epic
description: Work through one VibeDoc roadmap epic (plans/roadmap/R*.md) by itself. It claims the next ready task with vibedoc_next_task, implements it, runs the task's Verify commands, marks it done, commits, and repeats until the epic is finished or needs a human. Use this whenever the user says "work on epic R037", "implement R037", "/work-epic R037", "start the tasks in this epic", "keep going on the epic", "do the next task", or otherwise wants an agent to run an epic's tasks without picking each one by hand.
---

# Work an epic

Run one epic's tasks in order, one at a time, until VibeDoc says the epic is finished or a human is needed. VibeDoc picks the order: `vibedoc_next_task` respects `Depends on`, skips blocked tasks and tasks another agent has claimed, and moves the claimed task to in-progress so the board shows who is working on what. Don't choose tasks yourself, and don't work on a task you did not claim.

**Argument:** an epic id such as `R037`. If there is none, ask which epic to work on (`vibedoc_get_roadmap` lists them). Work on one epic only.

## Before the loop

Read the project's `CLAUDE.md` once. Task files quote the relevant rules, but the commands (build, lint, package manager), bans and commit rules are only in `CLAUDE.md`. You need them for every task.

## The loop

1. **Claim.** Call `vibedoc_next_task { "epic": "<id>" }`. The reply starts with one of three markers:
   - `🔨 Claimed` — go to step 2. The reply contains the full task file.
   - `⏳ Nothing ready` — see the stop rules below.
   - `✅ Epic … is finished` — see the stop rules below.

   If a reply ends with a `🗺️ Roadmap out of sync` hint for this epic (for example, set it to in-progress), apply it with `vibedoc_update_roadmap_item`, so the roadmap matches the board.
2. **Read the task.** If the reply has a `⚠️ Changes requested` line, a human sent this task back from review: that note is the first thing to fix, and the rest of the spec still applies. Read its Goal, Scope, Files, Implementation notes, Acceptance criteria and Verify. The task file is the spec. Stay inside its Scope: later tasks in the epic own the rest, and if you do their work now, their diffs will conflict with yours.
3. **Implement** the task, following the project's patterns.
4. **Verify.** Run every command in the task's **Verify** block, and check each acceptance criterion you can check. If something fails and the fix is inside the task's scope, fix it and run Verify again.
5. **Done.** Only when Verify passes: write a manual test report (below) and call `vibedoc_update_task { "taskId": "<id>", "status": "done", "manualTests": "<report>" }`, then commit that task's changes, following the repo's commit rules (message format, attribution, which files to stage). Each task leaves the app in a working state. When you commit after each task, it is safe to stop at any point, and a human can review or revert one task at a time.

   Use `"status": "review"` instead of done only when you can't judge the result yourself: a visual or UX change you couldn't look at, or a Verify step you couldn't run fully. Say why in your report. A task in review holds back the tasks that depend on it until a human approves it, so the default stays done.
6. **Repeat** from step 1. Mark the current task done before you call `vibedoc_next_task` again. If you don't, the task stays in-progress and the queue treats it as claimed by another agent.

## Manual test report

The report is what a person clicks through before they trust "done". It is saved in the task file as `## Manual tests`, shows as a `🧪 0/N` badge on the card, and is ticked off on `/manual-tests`. Write it from what you actually changed, not from the spec:

```md
### Steps
- [ ] Open /roadmap and click an epic → its sheet shows a Chat button next to Edit
- [ ] Click Chat → a chat opens titled "Epic R004" with three suggestions
### Regression risk
- [ ] Dragging a card between board columns still works
```

- 3–8 items, for someone who doesn't read the code: where to go, what to click, and what they should see (`→ expected result`).
- At least one **Regression risk** item: the existing feature your change most likely breaks.
- No item that only repeats a Verify command. Those already ran; the report covers what automation didn't.
- The report is encouraged, never required: a missing one doesn't block anything, but the human then has nothing to check.

## Stop rules

- **`✅ … is finished`:** report the tasks you completed. If the reply suggests setting the epic to done (`vibedoc_update_roadmap_item`), do that. Then stop.
- **`⏳ Nothing ready` with "Needs a human":** a task is blocked or in review, or depends on one. Report the reasons from the reply exactly as given and stop. Only a human can unblock, approve or send back the task, and if you continue you can only guess.
- **`⏳ Nothing ready` without "Needs a human":** the remaining tasks are in-progress, or they wait on in-progress tasks. Another agent owns those tasks. Report that and stop. Do not take over or re-claim their tasks.

## Failure rule

If Verify fails and you cannot fix it inside the task's scope:

1. Call `vibedoc_update_task { "taskId": "<id>", "status": "blocked" }`.
2. Add a short `## Blocked because` section to the end of the task file: what failed (the command and the important error line) and what a human must decide or fix.
3. Report this and stop. Do not commit the partial work, and do not claim the next task.

Never mark a task done when its Verify failed or was not run. A done task that is not really done breaks every task that depends on it, and the next agent trusts the board.

## Report

At the end, give a short summary: the tasks done (with their commits), the task that is blocked or waiting (with the reason), and why the run stopped.
