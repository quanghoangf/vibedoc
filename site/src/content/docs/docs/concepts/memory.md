---
title: Memory
description: The session handoff and one-fact knowledge entries that outlast a session.
sidebar: { order: 3 }
---

Agents forget between sessions. VibeDoc keeps two kinds of memory in your repo:

- **The handoff**, `memory/MEMORY.md`: what happened last session and what's next. [`vibedoc_read_memory`](/vibedoc/docs/tools/vibedoc_read_memory/) reads it at session start; [`vibedoc_update_memory`](/vibedoc/docs/tools/vibedoc_update_memory/) rewrites only the sections it is given, so hand-written sections survive. Every write keeps a snapshot you can restore from **Memory → History**.
- **Knowledge entries**, `memory/entries/E001-<slug>.md`: one fact per file, typed as convention, gotcha, decision or preference. [`vibedoc_save_entry`](/vibedoc/docs/tools/vibedoc_save_entry/) writes them; session start lists them within a token budget, and [`vibedoc_recall`](/vibedoc/docs/tools/vibedoc_recall/) finds them by keyword. Claiming a task also shows the related entries.

On `/memory` you can search, edit and delete entries, and see how they link to tasks and docs. [`vibedoc_import_memory`](/vibedoc/docs/tools/vibedoc_import_memory/) pulls in Claude Code's own memory files; [`vibedoc_export_memory`](/vibedoc/docs/tools/vibedoc_export_memory/) writes the entries into `AGENTS.md` / `CLAUDE.md` for agents that don't use MCP.

## Shared with your group

When repos make one product (an `api` and a `web`, say), put them in a group on `/projects`. A lesson learned in one repo can then reach the agents in the others.

An entry has a scope. By default it belongs to its project. Save it with `scope: "group"` and it is shared with every project in your project's groups:

<!-- vibedoc:steps -->
1. An agent in `api` calls `vibedoc_save_entry { type: "convention", summary: "Money is integer cents", scope: "group" }`. The file stays in `api/memory/entries/` and gets a `**Scope:** group` line, so git shares it like any other file.
2. The next session in `web` lists it in `vibedoc_read_memory` as `api:E002 (shared · api) · convention · Money is integer cents`. Shared lines come after the project's own entries and count toward the same token budget.
3. `vibedoc_recall` in `web` finds it, and so does a task's related memory. Fetch its body with `vibedoc_get_entries { ids: ["api:E002"] }`: the part before the colon is the owning project's id.

Entries with project scope never leave their repo. Saving with `scope: "project"` turns a shared entry back into a private one. A project in no group refuses `scope: "group"`, and its memory works exactly as before. The handoff, `MEMORY.md`, always stays per project.

On `/memory`, a project in a group gets a scope filter (**All · This project · Shared**). A shared row from another repo shows that repo's name. Editing it or deleting it changes the file in that repo. **Share with group** and **Keep in this project** switch an entry's scope.
