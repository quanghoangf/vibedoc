# R046: Project knowledge entries
**Parent:** R002
**Status:** planned
**Order:** 130
**Tasks:** T086, T087, T088

Facts that should outlast a session (conventions, gotchas, decisions, user preferences) live as separate entries next to the session handoff, so agents stop dropping them. Popular memory tools (mem0, grandma, Claude Code's own memory) all keep long-lived facts apart from session logs.

**In scope:** one fact per plain markdown file, kept in the project and in git; a type and a one-line summary for each entry; agents can add, update and remove entries; an index agents read at session start
**Out of scope:** smart or ranked search (R048); automatic extraction from sessions (R050)
**Done when:** a convention an agent saves in one session shows up in the next session's start without anyone putting it in the handoff
