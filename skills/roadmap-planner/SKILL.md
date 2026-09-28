---
name: roadmap-planner
description: Build an epic-level product roadmap for any project. Scans the project's docs, then interviews the user with checkbox questions about business goals, users and features only (no tech), and writes horizons (Now / Next / Later) with epics under them as VibeDoc roadmap items (plans/roadmap/R*.md). Use this whenever the user wants to create, generate, draft, plan or bootstrap a roadmap, asks "what should we build next", wants to turn a PRD / README / docs into epics, or wants to plan product phases or milestones, even if they don't say "VibeDoc" or "epic".
---

# Roadmap planner

Turn a project's docs plus a short interview into an epic-level roadmap: a few **horizons** on the spine, and **epics** under each one. Stop at epics. Breaking an epic into tasks is a separate step that happens later.

```
R001 Now          (horizon)
  R004 Auth & accounts    (epic)
  R005 Billing            (epic)
R002 Next         (horizon)
  R006 Team workspaces    (epic)
R003 Later        (horizon)
  R007 Public API         (epic)
```

## Stay at the business level

Every question and every epic is about **what** the product does and **for whom**. Leave out stack, architecture, databases, frameworks, infra and code structure. Those choices are made when an epic is broken into tasks. If you ask about them now, the interview gets longer and the user has to decide things too early. When a doc is mostly technical, take out the user-facing capability it describes and leave the rest.

## What an epic is

An epic is a user-visible capability, or a business outcome, that a small team ships in a few weeks to a couple of months. Some tests:

- Too small (a task): "Add Google login button", "Fix pagination".
- Too big (a theme): "Growth", "Better UX", "Scale".
- Right: "Social sign-in", "Self-serve billing", "Team workspaces", "Onboarding checklist".

Aim for 5–15 epics in total. Use short noun phrases as titles (2–5 words).

## Process

### 1. Check what exists

Read the current roadmap. Call `vibedoc_get_roadmap` if the VibeDoc MCP tools are available. If they are not, list `plans/roadmap/R*.md`.

The VibeDoc server writes to the project it was started for, and that may not be the one you are in. Call `vibedoc_get_status` and compare the project name in its heading with the current directory. If they do not match, do not use the MCP tools for this run. Use the file fallback in step 5 and tell the user why.

If items already exist, ask once (single-select) whether to **add epics to the existing roadmap** (reuse the existing horizons and skip epics that are already there) or **stop**. Never delete or rewrite existing items. The user owns them.

### 2. Scan the docs

Read enough to form an opinion, not everything. In priority order:

1. `README*`, `CLAUDE.md` / `AGENTS.md`, `ROADMAP.md`, anything named PRD / spec / vision / brief
2. `docs/**/*.md`: skim titles and first paragraphs, and read the product-facing ones in full
3. `plans/tasks/*.md` (or other task files): done tasks show what is already shipped, open tasks show intent
4. `package.json` / `pyproject.toml` description, plus the top-level routes, pages or commands (to see which features actually exist)

Stop when the answers to the next step stop changing. Collect the following. Tag each item as **stated** (a doc says it) or **inferred** (your guess):

- what the product is and the problem it solves
- who uses it
- capabilities that are already shipped
- capabilities that are planned or requested but not built
- gaps you would expect for this kind of product

### 3. Play back, then interview

Start with a 3–5 line summary of what you understood, so the user can correct you before any questions. Then use `AskUserQuestion` for every question.

**Question rules**

- Use checkboxes (`multiSelect: true`) by default. Use single-select only when the answers are truly exclusive, for example product stage.
- Take the options from the docs, not from a generic list. "Solo devs using Claude Code" is better than "Developers". The user can always pick "Other" to type their own answer.
- A call has at most 4 questions, and each question has 2–4 options. Put related questions in the same call, and do not ask about something the docs already answer clearly.
- Mark your best guess with "(Recommended)" and put it first. Add a short `description` to options when the label is not self-explanatory.
- A `header` has a maximum of 12 characters (e.g. "Users", "Shipped", "Collab").

**Rounds** (skip any round the docs already settle)

1. **Product & users**: primary users (multi), the main problems they hire the product for (multi), product stage (single: idea / MVP / live with users / scaling), what success looks like in the next 6–12 months (multi: e.g. first paying customers, retention, team adoption, launch publicly).
2. **Shipped**: only when there is evidence of built features. "Which of these are already shipped?" (multi), with the candidate epics. Shipped epics go under a `Shipped` horizon with status `done`, so the map shows where the product is today.
3. **Candidate epics**: "Which of these belong on the roadmap?" Offer the candidates that are not shipped. Because of the 4-options limit, split them into themed questions of 3–4 each (e.g. "Onboarding & accounts", "Collaboration", "Monetization"), up to 4 questions per call. Put **stated** epics first and **inferred** ones after them, with the reason in the description. Pick 1–2 gaps the user probably has not thought of and include them as well. Proposing these is part of the job.
4. **Horizons**: first ask how to name them (single: `Now / Next / Later` (Recommended), versions like `v1 / v2 / v3`, or quarters). Then place the chosen epics: "Which of these are Now?" (multi), then "Of the rest, which are Next?" (multi). Everything left over goes to Later. If an epic is already being built, ask whether to mark it `in-progress`.

When an answer changes the picture (for example, the user says the product is for teams and not for individuals), ask a follow-up round before you continue.

### 4. Confirm the draft

Show the full tree in the terminal as plain text. Give each epic a one-line outcome under its title. Then ask one single-select question: **Create it** (Recommended) / **Adjust** (the user then says what to change, and you ask this question again). Do not write anything before the user confirms.

### 5. Write it

For every epic, write a short body. The person who breaks the epic into tasks later reads this body first, so it must stand alone:

```
<One sentence: the user outcome this delivers and why it matters now.>

**In scope:** <2–4 bullet-ish phrases>
**Out of scope:** <what's explicitly deferred>
**Done when:** <an observable success signal>
```

Horizons get a one-line body that describes the phase, e.g. "What we're building right now to reach first paying teams."

**In the VibeDoc chat** (you have `vibedoc_propose_plan`): don't write anything yourself. Put all horizons and epics (`kind: "roadmap"`) in one `vibedoc_propose_plan` call. The user's Accept writes them, so skip the rest of this step.

**Via MCP (preferred)**: when the `vibedoc_*` tools are available, use them. They keep the live VibeDoc UI in sync and serialize writes.

1. Create each horizon with `vibedoc_create_roadmap_item` `{title, status, order, body}` and no `parent`. Horizons go in time order, with order steps of 10: Shipped → Now → Next → Later. Record the returned id.
2. Create each epic with `{title, parent: <horizon id>, status, order, body}`. Order steps of 10 in priority order inside the horizon. Leave out `tasks` because the breakdown comes later.

**Via files (fallback)**: use this when the MCP tools are not available. Write `plans/roadmap/R<NNN>-<kebab-slug>.md`. Continue numbering from the highest existing `R` id, and pad to 3 digits. Use this exact format. The parser only reads the `**Key:** Value` block directly under the H1.

```markdown
# R004: Self-serve billing
**Parent:** R001
**Status:** planned
**Order:** 20
**Tasks:** —

<body>
```

Keep the blank line after `**Tasks:**`. Without it, the body's `**In scope:**` line is read as meta. Leave out `**Parent:**` for horizons. `Status` is one of `planned | in-progress | done`. Do not touch `plans/roadmap/layout.json`. Items without a saved position are placed automatically.

### 6. Hand off

Reply with a short list: the horizons, the epic count per horizon, and the ids created. Offer the next step in one line: break one epic into tasks, starting with the first epic in Now.
