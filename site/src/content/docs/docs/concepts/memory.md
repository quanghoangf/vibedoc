---
title: Memory
description: The session handoff and one-fact knowledge entries that outlast a session.
sidebar: { order: 3 }
---

Agents forget between sessions. VibeDoc keeps two kinds of memory in your repo:

- **The handoff**, `memory/MEMORY.md`: what happened last session and what's next. [`vibedoc_read_memory`](/vibedoc/docs/tools/vibedoc_read_memory/) reads it at session start; [`vibedoc_update_memory`](/vibedoc/docs/tools/vibedoc_update_memory/) rewrites only the sections it is given, so hand-written sections survive. Every write keeps a snapshot you can restore from **Memory → History**.
- **Knowledge entries**, `memory/entries/E001-<slug>.md`: one fact per file, typed as convention, gotcha, decision or preference. [`vibedoc_save_entry`](/vibedoc/docs/tools/vibedoc_save_entry/) writes them; session start lists them within a token budget, and [`vibedoc_recall`](/vibedoc/docs/tools/vibedoc_recall/) finds them by keyword. Claiming a task also shows the related entries.

On `/memory` you can search, edit and delete entries, and see how they link to tasks and docs. [`vibedoc_import_memory`](/vibedoc/docs/tools/vibedoc_import_memory/) pulls in Claude Code's own memory files; [`vibedoc_export_memory`](/vibedoc/docs/tools/vibedoc_export_memory/) writes the entries into `AGENTS.md` / `CLAUDE.md` for agents that don't use MCP.
