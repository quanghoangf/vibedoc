# T116: Docs + e2e check for automatic episodes
**Status:** ✅ Done
**Phase:** R050 — Automatic session episodes
**Size:** S
**Depends on:** T115
**Done:** 2026-10-03

## Goal
Agents and humans know episodes exist, where they live and when they're written; an e2e check guards the epic's Done when.

## Context
- Epic: `plans/roadmap/R050-automatic-session-episodes.md`
- Behaviour from t1–t3: episodes in `.vibedoc/episodes/<sessionId>.md`, written at chat turn end, epic-run end and by lazy backfill; surfaced by `vibedoc_read_memory` when newer than MEMORY.md.
- Existing docs to extend: the MCP tools reference (`vibedoc_read_memory`, `vibedoc_next_task`) and the sessions / activity schema docs written in T050. Find them with a search for `vibedoc_get_sessions`.

## Scope
- [x] Docs: a short "Automatic session episodes" section (what, when written, file format, how read_memory shows them, that they never touch MEMORY.md)
- [x] Update the `vibedoc_read_memory` and `vibedoc_next_task` entries in the MCP tools doc
- [x] Note in the agent guidance (chat preamble / CLAUDE.md snippet) that calling `vibedoc_update_memory` is still preferred; episodes are the safety net
- [x] E2E: drive one chat turn that moves a task without a memory update, then assert an episode file exists and a fresh `vibedoc_read_memory` includes `Since the last handoff` (follow the existing e2e setup used for the chat tests)

**Out of scope:** new features.

## Files
- MCP tools doc, sessions doc (paths from the search above)
- `README.md` if it lists memory features
- the e2e spec folder used by the recent chat tests

## Acceptance criteria
- [x] Docs describe trigger points, file location/format and read_memory behaviour
- [x] E2E test passes locally and fails if t1's write hook is removed
- [x] Every epic Done-when item is demonstrably covered (chat ends with no memory tool → episode → next session sees it)

## Verify
```bash
pnpm build && pnpm lint
# run the project's e2e command (see package.json scripts) for the new spec
```

## Manual tests
_2026-10-03 — ai_
### Steps
- [ ] Open docs/architecture/mcp-tools.md in /docs → an "Automatic session episodes" section lists the three triggers, the file path and a sample episode
- [ ] Read the `vibedoc_read_memory` and `vibedoc_next_task` entries → both mention episodes ("Since the last handoff", "Episode saved →")
- [ ] Open README.md → the CLAUDE.md snippet says episodes are a safety net, still call vibedoc_update_memory
- [ ] Run `pnpm build && PW_DIR=<playwright dir> node e2e/session-episodes.mjs` → three "ok" lines, exit 0
- [ ] In a real chat, ask the agent to move a task without saving memory → a file appears in .vibedoc/episodes/ and a new session's read_memory shows it
### Regression risk
- [ ] Other chat e2es (stub-chat, parallel-chats) still pass; the new e2e starts its own `next start` on a free port and needs a fresh `pnpm build`
