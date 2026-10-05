---
title: Tasks and the board
description: One markdown file per task; the board, statuses, dependencies and review.
sidebar: { order: 1 }
---

A task is one file, `plans/tasks/T001-<slug>.md`. The H1 is its id and title; the `**Key:** Value` lines directly under it are its properties; everything after the first blank line is the spec the agent reads.

```markdown
# T031: Checkout happy path
**Status:** 📋 Todo
**Phase:** R005 — Self-serve billing
**Depends on:** T030
**Priority:** P1

## Goal
…
```

- **Statuses:** todo, in-progress, review, done, blocked, paused, cancelled. Add your own under **Settings → Statuses**; each maps onto one of the built-in ones.
- **Dependencies:** `**Depends on:**` holds a task back until those tasks are done. [`vibedoc_next_task`](/vibedoc/docs/tools/vibedoc_next_task/) only hands out ready tasks and never one another agent has claimed.
- **Owner and dates:** an agent that starts a task becomes its owner (`ai:claude-code`); Started and Done are stamped, and an empty due date is filled from the task's size.
- **Review:** when an agent finishes a task but leaves checks for a person, it lands in **review** instead of done. Approve it, or send it back with a note the next agent reads first.

The board (`/board`) shows the files as columns, a table, grouped by epic, or a timeline. Moving a card rewrites the `**Status:**` line; the agent sees the change on its next call. Everything is in your repo, so git is the history.
