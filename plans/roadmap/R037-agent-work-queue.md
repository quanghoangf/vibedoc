# R037: Agent work queue
**Parent:** R002
**Status:** planned
**Order:** 50
**Tasks:** T030, T031, T032, T033, T034

Let an agent ask VibeDoc for the next task and work through an epic on its own, so a human sets direction once instead of hand-picking every task.

**In scope:** next-task selection that respects Depends on and epic order, skipping blocked and in-progress tasks, claiming a task so two agents don't take the same one, a clear 'epic finished' signal
**Out of scope:** verification gates (R043), scheduling across several epics at once
**Done when:** an agent given only an epic id completes its tasks in a valid order with no human picking tasks
