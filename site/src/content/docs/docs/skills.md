---
title: Skills (/vibedoc:*)
description: The four Claude Code commands that run the plan, build, prove, review loop.
---

The planning loop ships as a Claude Code plugin named `vibedoc`. Install it once:

```text
/plugin marketplace add quanghoangf/vibedoc
/plugin install vibedoc@vibedoc
```

| Command | What it does |
|---|---|
| `/vibedoc:roadmap` | Reads your docs, interviews you about users and goals (no tech questions), and writes horizons and epics to `plans/roadmap/R*.md`. |
| `/vibedoc:breakdown R004` | Breaks one epic into tasks an agent can pick up cold: scope, files, acceptance criteria and verify commands, each seeded with the epic's scenarios. |
| `/vibedoc:work R004` | Claims the epic's next ready task, builds it, runs its checks and a Playwright spec, marks it done or sends it to review, commits, and repeats. |
| `/vibedoc:next` | Reads the board, roadmap, activity and git, and recommends the one most useful next step with the command to run. |

In Cursor or any other MCP client, the same steps are the `vibedoc_*` tools: [`vibedoc_get_roadmap`](/vibedoc/docs/tools/vibedoc_get_roadmap/), [`vibedoc_next_task`](/vibedoc/docs/tools/vibedoc_next_task/), [`vibedoc_update_task`](/vibedoc/docs/tools/vibedoc_update_task/).

Working on the skills themselves: start Claude Code with `claude --plugin-dir ./plugin` in the VibeDoc repo, and run `/reload-plugins` after edits (an installed plugin is a copy).
