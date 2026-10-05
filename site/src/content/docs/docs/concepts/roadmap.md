---
title: Roadmap and epics
description: Horizons and epics as files, scenarios as the epic's acceptance tests.
sidebar: { order: 2 }
---

The roadmap is `plans/roadmap/R*.md`. An item without `**Parent:**` is a **horizon** (Now, Next, Later); an item with one is an **epic** under it. An epic lists its tasks in `**Tasks:**`.

```markdown
# R005: Self-serve billing
**Parent:** R001
**Status:** in-progress
**Tasks:** T030, T031, T032

Teams pay without talking to us.

**In scope:** monthly plans, invoices page
**Done when:** a team upgrades and sees its first invoice

## Scenarios
### S1: Upgrade
- WHEN an admin picks the monthly plan and pays
- THEN the workspace shows Pro and the invoice is listed
```

- **Scenarios** are the epic's promise as numbered WHEN/THEN cases. Each task names the ones it makes true (`**Covers:** S1`), and its test checklist starts with them. The epic sheet shows each scenario as passed, failed or unproven.
- **Progress and drift are derived**, never stored: an epic whose tasks are all done but which isn't marked done, an overdue or at-risk epic, or a scenario no task covers shows under **Needs attention**.
- Positions on the map live in `plans/roadmap/layout.json`, never in the epic files.

`/vibedoc:roadmap` writes the horizons and epics with you; `/vibedoc:breakdown` turns an epic into tasks.
