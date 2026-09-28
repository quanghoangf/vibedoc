---
name: epic-breakdown
description: Break one roadmap epic (a VibeDoc plans/roadmap/R*.md item) into implementation tasks written for a coding agent. It takes an epic id or file path; with no argument it lists the epics with their status and asks which one to break down. It then asks checkbox questions about scope, effort budget, quality bar and constraints, reads the relevant code, and writes plans/tasks/T*.md files (real files to touch, acceptance criteria, verify commands) linked back to the epic. Use this whenever the user wants to break down, split, decompose, plan or "task out" an epic, feature or roadmap item, asks "what are the tasks for R004", or wants the next epic turned into work an agent can pick up, even if they don't say "epic".
---

# Epic breakdown

Turn one epic into a short, ordered list of tasks. A coding agent should be able to pick up any one of them cold and finish it. This skill is a follow-up to `roadmap-planner`: epics are roadmap items that have a `**Parent:**` (horizon), and their body often already contains **In scope / Out of scope / Done when**.

The tasks are the product of this skill. Someone who reads a task file should know what to build, where it goes, how it follows the codebase's patterns, and how to prove it works, without asking anyone. A vague task gets a vague implementation.

## 1. Pick the epic

**Argument given:** resolve it.

- An id: `R004`, `r4`.
- A path: `plans/roadmap/R004-billing.md`.
- A title fragment: match it against the titles.

Read the file. If what you read is a horizon (it has no `**Parent:**`), say so and treat it as "no argument", listing only that horizon's epics.

**No argument:** list the epics and let the user choose.

1. Get every item with `vibedoc_get_roadmap` (MCP), or read `plans/roadmap/R*.md`. Epics are the items that have a parent.
2. Print a compact table: id, title, horizon, status, and linked task count with their done count. For example:

   ```
   ID    Epic                 Horizon  Status       Tasks
   R005  Self-serve billing   Now      in-progress  2/5 done
   R006  Team workspaces      Now      planned      —
   R009  Public API           Next     planned      —
   ```

3. Ask one single-select `AskUserQuestion` with the 3–4 most likely candidates, in this order: in-progress epics first, then planned epics with no tasks in the earliest horizon. Leave out `done` epics. The user can pick "Other" to type any id.

If the chosen epic already has linked tasks, show them and ask whether to **add the missing tasks** or **stop**. Never rewrite existing task files, because an agent may already be working from them.

## 2. Understand before asking

Read the context that grounds the questions. Every question should come from something you found, not from a generic checklist.

- The epic body, its horizon, and sibling epics. Siblings show what is deliberately left for a later epic.
- `CLAUDE.md` / `AGENTS.md`, plus architecture docs that touch this area. These give the rules the tasks must obey: layers, banned patterns, required commands.
- **The code the epic will touch.** Find the existing modules, routes, components and data files in this area, and how a similar feature was built before. Delegate a broad sweep to an Explore agent if the area is large. You need concrete file paths and patterns to reuse, not a full audit.
- Existing `plans/tasks/` files, to see the numbering, the format, and work that may overlap.

## 3. Interview

Play back the epic in 2–3 lines: what it delivers, and what you found in the code (for example: "No billing code exists yet. Payments would go through `src/lib/…`, following how X was done."). Then ask with `AskUserQuestion`.

**Question rules** (same as `roadmap-planner`):

- Use checkboxes (`multiSelect: true`) by default. Use single-select only when the answers are exclusive.
- Put "(Recommended)" on your best guess and list it first.
- Take the options from this epic and this codebase.
- A call has at most 4 questions with 2–4 options each, and each `header` has at most 12 characters.
- Skip any question the docs or the epic body already answer.

**Round 1: scope and effort**

- **Scope:** "Which of these are in this epic?" (multi). List the concrete capabilities you can see, e.g. "Monthly plans", "Annual plans", "Invoices page", "Proration". Whatever is not checked becomes **Out of scope** in every task.
- **Effort budget:** a single-select option for each budget, e.g. "~1–2 days (3–4 tasks)", "~1 week (5–8 tasks)", "~2 weeks (8–12 tasks)". Recommend one based on the scope. The budget limits the task count. If the epic has a `**Due:**`, name it in the question and recommend the budget that fits it; otherwise add an option for the user to give a target date. If the checked scope does not fit the budget, say so and ask what to drop. Do not cram it in.
- **Slice strategy:** single-select. Choose between "Thin vertical slice first, then widen" (Recommended for anything user-facing) and "Foundation first (data → API → UI)".

**Round 2: quality and constraints** (only what this epic needs)

- **Quality bar** (multi): unit tests for logic, an integration or API test, an E2E/browser check, docs updates, a feature flag.
- **Constraints and decisions** (multi): the real forks you found in step 2. Examples: "Reuse `X` vs build a new `Y`", "Store in file vs a new table", "Must stay backward compatible with Z". This is the one place where technical questions are right. Each one decides the content of a task, and the implementing agent should not have to guess.
- **Out-of-epic dependencies:** anything that must exist first, such as an API key, a design, or another epic. Such dependencies become explicit `Depends on` entries, or a blocking note.

Ask follow-up questions when an answer opens a new fork. Stop when every task you plan has no open decisions left in it.

## 4. Slice into tasks

Each task is **one coherent change an agent can finish, verify and commit in one session**:

- **S:** about 1h.
- **M:** 2–3h.
- **L:** half a day. Anything bigger gets split.

Good slicing rules:

- **Each task leaves the app working.** Build, lint and tests pass after every task, not only after the last one. That makes every task safe to merge and safe to stop after.
- **Vertical before horizontal.** When you can, the first task ships a thin end-to-end path, e.g. one plan, happy path only, from UI to storage. Later tasks widen it. A "types only" or "all the API routes" task is harder to verify and hides problems until the end.
- **Order by dependency, then by risk.** Put the unknowns (a new integration, a tricky migration) early, so they surface while the plan can still change.
- **No overlap.** Two tasks should not edit the same function for different reasons. Merge them, or make one depend on the other.
- **Every epic "Done when" criterion must be covered by some task's acceptance criteria.** Check this before you continue.

Show the plan as a plain-text table, not the full files yet:

```
#  Task                                  Size  Depends on
1  Billing data model + plan catalog     S     —
2  Checkout happy path (monthly plan)    M     1
3  Webhook: activate/cancel subscription M     2
...
Total ≈ 9h — fits the "~1 week" budget.
```

Ask a single-select question: **Create tasks** (Recommended) / **Adjust**. If the user picks Adjust, they say what to change and you ask again.

## 5. Write the tasks

Continue the numbering from the highest existing `T` id, padded to 3 digits. Write the files to `plans/tasks/T<NNN>-<kebab-slug>.md`. There is no MCP tool that creates tasks, so write the files directly.

Use this template. The board parser reads only the contiguous `**Key:** Value` block directly under the H1. Don't put blank lines inside that block, or any fields after the blank line are ignored.

````markdown
# T031: Checkout happy path (monthly plan)
**Status:** 📋 Todo
**Phase:** R005 — Self-serve billing
**Size:** M (2–3 hrs)
**Depends on:** T030
**Due:** 2026-10-15

## Goal
<1–2 sentences: the user-visible result and why it matters for the epic.>

## Context
- Epic: `plans/roadmap/R005-self-serve-billing.md`
- <Decisions made in the interview that apply here, stated as facts: "Plans are stored in `plans.json`, not a DB table.">
- <Project rules that bite here, quoted from CLAUDE.md: "Only `src/lib/core.ts` touches the file system.">

## Scope
- [ ] <Concrete, checkable step>
- [ ] …

**Out of scope:** <what a later task or epic handles — name it: "Annual plans (T034)">

## Files
- `src/app/api/checkout/route.ts` — new; <what goes in it>
- `src/lib/core.ts` — add `createCheckout()`; follow `createTask()` for id/slug handling

## Implementation notes
<Only what the agent can't cheaply work out: which existing helper to reuse, the pattern to copy (with a file:line pointer), gotchas you saw in the code, a short signature or data shape when it pins down an interface another task depends on. No full implementations — the agent writes the code.>

## Acceptance criteria
- [ ] <Observable behavior: "POST /api/checkout with plan=monthly returns a session URL">
- [ ] <Edge/error case that matters: "Unknown plan → 400 with error message">
- [ ] <Quality-bar items chosen in the interview: "Unit test for price calculation">

## Verify
```bash
<exact commands from this project: build, lint, tests, a curl or a page to open>
```
````

`**Due:**` is optional. Add it only when the user gave a target date in the interview: spread the dates across the tasks in dependency order so the last task lands on the epic's due date. Use a local calendar date (`YYYY-MM-DD`). The roadmap sheet shows it and flags overdue tasks.

Adjust the headings to the project if its existing tasks use a different but richer format. Keep **Goal, Scope, Files, Acceptance criteria and Verify** in all cases. They are what lets an agent work without asking questions.

**Link the tasks to the epic.** Call `vibedoc_update_roadmap_item` with `{ id, tasks: [...existing, ...new] }` when MCP is connected. Otherwise, rewrite only the epic's `**Tasks:**` line (e.g. `**Tasks:** T030, T031, T032`). If the epic was `planned`, leave its status unchanged. Starting work is the user's call.

**Wrong-project guard:** the VibeDoc MCP server writes to the project it was started for. Before you use `vibedoc_update_roadmap_item`, make sure the project name from `vibedoc_get_status` matches the current directory. If it does not, edit the file directly.

## 6. Hand off

Reply with the created task ids and titles, the total estimate against the budget, and which task to start with. Offer to start that first task in one line.
