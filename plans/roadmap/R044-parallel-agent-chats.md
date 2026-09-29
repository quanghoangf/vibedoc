# R044: Parallel agent chats
**Parent:** R002
**Status:** planned
**Order:** 110
**Tasks:** T055, T056, T057, T058, T059

Run several agent chats at once from the UI, so breaking down three epics takes as long as the slowest one instead of all three back to back.

**In scope:** one chat session per conversation, each with its own `claude -p` turn; switching between running chats in the sidebar; "Break down with agent" on a second epic starts a new chat instead of being refused while another runs; a running/idle/needs-review marker per chat; closing a tab stops its agent; picking several epics at once from the roadmap (max 4 running); accepting plans from several chats without task-id collisions
**Out of scope:** chats that survive a page reload or server restart, multi-select on the map canvas, running MCP work queues (`vibedoc_next_task`) in parallel, non-Claude agents
**Done when:** a user clicks "Break down with agent" on three epics in a row, all three run at the same time, and each plan card can be accepted with no duplicate T-numbers
