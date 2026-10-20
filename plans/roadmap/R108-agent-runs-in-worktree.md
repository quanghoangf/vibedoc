# R108: Agent runs in a worktree
**Parent:** R002
**Status:** in-progress
**Order:** 490
**Tasks:** T566, T552, T553, T554, T555, T557, T567, T558, T556, T568, T563, T564, T561, T562, T559, T560, T565

The user starts work on an epic or a task from VibeDoc, accepts a run card, and a worker agent writes the code task by task in its own git worktree, so work gets done without a terminal open and without touching the user's checkout.

ADR: ADR-007

**In scope:** a spike that checks headless `claude -p` on a real epic before anything is built; a "Work with agent" action on an epic and a task that shows a run card at once, computed by the server (new worktree + branch + base, or send to the worker that already has this epic; the allowed tools; the budget); nothing is created before the user accepts; a worker = a chat with a worktree in `~/.vibedoc/worktrees/<project>/<branch>`, dependencies installed; the server drives the worker task by task (claim the next task, run `claude -p "/vibedoc:work <task>"` in a fresh session, then the next), so each task has a clean context and is a checkpoint; one worker per epic, a limit on workers at the same time; task status and meta go to the project the board shows, code commits stay on the worker's branch; the worker may edit files and run the allowed commands, never push, with a minimal environment (no secrets passed through); a turn and time budget per task, usage limits pause the worker instead of failing it; each finished task is verified (R067) before the next one starts; its own dev server and port, so UI specs test the branch; a question from the worker waits on the user (needs you, inbox), the answer resumes that task's session; workers survive a reload and a VibeDoc restart (or show Resume); at the end the branch diff, Open PR, Merge, Remove worktree; an optional orchestrator chat per project that knows every worker, answers "who is working on what" and proposes runs with the same run card
**Out of scope:** agents other than Claude Code; several workers on one epic; running in the cloud or on another machine; a real sandbox for the worker (the allowlist limits tools, it does not isolate the machine; ADR-007 says so); resolving merge conflicts for the user; auto-merge; the orchestrator writing code itself
**Done when:** the user clicks "Work with agent" on an epic with ready tasks, accepts the run card, closes the tab, and later finds the tasks done and verified on the board and a branch with one commit per task ready to review, while their own checkout has no code changes

## Scenarios
### S1: Isolated run
- WHEN the user accepts a run card for a new worktree
- THEN a new worktree and branch exist, the worker's commits land only there, and the user's checkout has no code changes
### S2: Board follows the run
- WHEN the worker claims and finishes a task in the worktree
- THEN the card moves on the board in real time, like a terminal session
### S3: Worker asks
- WHEN the worker needs a decision mid-task
- THEN the worker waits on the user, the inbox counts it, and the user's answer continues that task's session in the same worktree
### S4: Outside the allowlist
- WHEN the worker tries a command it was not allowed (e.g. `git push`)
- THEN it is refused, and the worker's log shows what was refused
### S5: Survives a restart
- WHEN VibeDoc restarts while a worker runs
- THEN the worker keeps going (including the next task) and the page follows it again, or it shows as interrupted with Resume, never silently lost
### S6: Finish
- WHEN a worker's run ends
- THEN the user sees the branch diff and can open a PR, merge, or remove the worktree
### S7: Existing worker
- WHEN the user starts work on an epic that already has a worker
- THEN the run card proposes sending it to that worker, and no second worktree is made
### S8: Proposal first
- WHEN the user clicks "Work with agent"
- THEN a run card shows at once, and nothing is created or started until the user accepts it
### S9: Worker tests its own branch
- WHEN a worker runs a UI spec
- THEN it hits the worktree's own app on its own port, not the user's running app
### S10: Budget and usage limits
- WHEN a task runs past its turn or time budget, or the account hits a usage limit
- THEN the worker stops that task and waits on the user (budget) or shows paused and continues by itself later (usage limit), never burns on
### S11: Verified before the next task
- WHEN a task finishes with critical or major verification findings
- THEN the worker fixes them once in the same worktree, else waits on the user, and only then claims the next task
### S12: Orchestrator overview
- WHEN the user asks the orchestrator chat who is working on what
- THEN it answers from the live workers, and any run it suggests comes as the same run card

## Spec changes
### agent-runs
#### ADDED Requirement: Isolated worker
The system SHALL run a worker agent only inside its own git worktree and branch outside the project folder, and SHALL leave the user's checkout without code changes.
##### Scenario: New worktree
- WHEN the user accepts a run card for a new worktree
- THEN the worktree and branch exist and the worker's commits are only on that branch
#### ADDED Requirement: Task by task
The system SHALL run a worker one task per agent session, claiming the next ready task only after the previous one is done and verified.
##### Scenario: Next task
- WHEN a worker's task is done and verified
- THEN the next ready task of its epic starts in a new session
#### ADDED Requirement: Board follows the worker
The system SHALL write a worker's task status and meta to the project the board shows, so the board moves while the worker runs.
##### Scenario: Task done in a worktree
- WHEN the worker marks a task done
- THEN the board shows it done without a reload
#### ADDED Requirement: Worker asks the user
The system SHALL show a worker's question as waiting on the user and SHALL resume the same task session in the same worktree with the answer.
##### Scenario: Answer
- WHEN the user answers a worker's question
- THEN the worker continues where it stopped
#### ADDED Requirement: Worker permissions
The system SHALL let a worker use only the allowed tools and commands with a minimal environment, SHALL never let it push, and SHALL show refused calls in its log.
##### Scenario: Push refused
- WHEN a worker runs `git push`
- THEN the call is refused and the log names it
#### ADDED Requirement: Worker budget
The system SHALL stop a task that passes its turn or time budget and SHALL pause, not fail, a worker that hits a usage limit.
##### Scenario: Over budget
- WHEN a task passes its turn budget
- THEN the task stops and the worker waits on the user
#### ADDED Requirement: Verified before the next task
The system SHALL verify each task a worker finishes and SHALL not claim the next task while critical or major findings are open.
##### Scenario: Findings
- WHEN verification reports a major finding
- THEN the worker fixes it once or waits on the user
#### ADDED Requirement: Worker survives a restart
The system SHALL keep a worker running across a reload or a VibeDoc restart, including starting its next task, or SHALL show it as interrupted with Resume.
##### Scenario: Restart
- WHEN VibeDoc restarts while a worker runs
- THEN the worker's page follows the same run again or offers Resume
#### ADDED Requirement: Worker tests its own branch
The system SHALL give each worker its own app address for UI specs and SHALL never point a worker at the user's running app.
##### Scenario: Own port
- WHEN a worker asks for the frontend app
- THEN it gets the worktree's folder and port
#### ADDED Requirement: Run card
The system SHALL show a run card computed from the project's workers when the user starts work, SHALL start nothing before the user accepts it, and SHALL allow at most one worker per epic.
##### Scenario: Existing worker
- WHEN the user starts work on an epic that has a worker
- THEN the run card sends it to that worker
#### ADDED Requirement: Orchestrator chat
The system SHALL offer one orchestrator chat per project that reads every worker and proposes runs only as run cards.
##### Scenario: Overview
- WHEN the user asks the orchestrator who is working on what
- THEN it lists the live workers
#### ADDED Requirement: Finish a worker
The system SHALL show a finished worker's branch diff and SHALL offer Open PR, Merge and Remove worktree, each only after the user confirms; Merge SHALL ignore the user's uncommitted VibeDoc files (plans/, memory/, .vibedoc/).
##### Scenario: Remove
- WHEN the user removes a worker's worktree
- THEN the folder is gone and the worker no longer counts toward the limit
