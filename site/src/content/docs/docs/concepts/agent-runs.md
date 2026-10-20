---
title: Agent runs
description: Start a coding agent on an epic or a task from VibeDoc. It works task by task in its own git worktree while the board follows it.
sidebar: { order: 7 }
---

Click **Work with agent** on an epic or a task (or press <kbd>⇧W</kbd> with it open) and a worker takes the work: it claims each ready task, writes the code in its own git worktree, verifies it, commits it on its own branch and moves on. You can close the tab. Later you find the tasks done on the board and a branch with one commit per task, and your own checkout has no code changes.

## How it works

1. **Run card** — the server works out the run at once: a new worktree on `vibedoc/<id>`, or the epic's existing worker. It shows the branch, the base, the allowed and denied tools and the budget. Nothing is created until you click **Start worker**; then you land on the worker's chat on `/chat`.
2. **Worktree** — `~/.vibedoc/worktrees/<project>/<branch>` (or under `$VIBEDOC_HOME`), outside your repo, with its own dependency install (the chat shows *Setting up the worktree* while it runs; a failed install shows its output) and its own dev server port, so a UI spec tests the branch and not the app you have running.
3. **One task at a time** — each task runs `/vibedoc:work <task>` in a fresh Claude Code session. The task status lands in your checkout, so the board moves live. The code commit stays on the worker's branch.
4. **Verify** — after each task a read-only review checks the code against the task. Critical or major findings get one fix in the same session. If they remain, the task is sent back and the worker waits on you.
5. **Finish** — when the epic is done the worker chat shows what the branch changed, with **Open PR**, **Merge into &lt;base&gt;** and **Remove worktree**.

A worker is a chat: it shows in the sidebar's Agents list and on `/chat`, and a worker that needs you counts in the inbox. If VibeDoc restarts, a running worker keeps going; a task that stopped while VibeDoc was down shows as **Interrupted** with **Resume**.

One epic has at most one worker. Workers on different epics run side by side, up to **Workers at the same time**. Starting work on an epic that already has a worker proposes sending the run to that worker, never a second worktree.

## The limits

- **No permission prompts mid-turn.** A worker can't stop to ask "may I run this?". What it may run is decided up front by the allowlist. A call outside it is refused, and the refusal shows in the worker's chat.
- **The allowlist is not a sandbox.** It limits which tools a worker calls. A worker that may run `pnpm *` can run any package script, so any code, as you. `git push` and `gh` are always denied, whatever the settings say.
- **Minimal environment.** A worker gets only `PATH HOME USER SHELL LANG TERM TMPDIR`, plus the names you list. Tokens in VibeDoc's own environment never reach it unless you list them.
- **Budgets.** Each task has a turn budget (model round trips) and a time limit. Past either one, the task stops and the worker waits on you. Your answer resumes it with the budget again.
- **Usage limits.** Near your Claude usage limit the worker shows **Paused** and continues by itself when the limit resets.
- **No interrupting a task.** You talk to a worker only when it asks you something. To stop it, use **Stop**: the task stays in progress and nothing else is claimed.
- **The orchestrator chat is optional.** **Ask the orchestrator** answers "who is working on what" from the live workers. It proposes runs only as the same run card and never starts anything or writes code.

## Settings

**Settings → Workers** writes `workers` in `.vibedoc/settings.json`:

| Setting | Default | What it does |
|---|---|---|
| Allowed tools (`allowedTools`) | VibeDoc's tools, Edit/Write/Read/Glob/Grep, `git add/commit/status/diff/log`, `pnpm`/`npm`/`node`/`npx` | Claude Code permission rules, e.g. `Bash(make *)`. Empty = the default list |
| Environment variables (`env`) | none | Extra variable names a worker inherits, e.g. `DATABASE_URL` |
| Workers at the same time (`maxRunning`) | 2 | A start past the limit is refused |
| Turns (`maxTurnsPerTask`) | 60 | `--max-turns` for each task |
| Minutes (`taskTimeoutMin`) | 30 | A task running longer is stopped |
| `verify` | `true` | `false` skips the review after each task |

Workers need Claude Code logged in on this machine. They run under your Claude account, the same as a terminal session.
