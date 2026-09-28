# T049: MCP tool vibedoc_get_sessions
**Status:** ✅ Done
**Phase:** R041 — Agent session timeline
**Size:** S
**Depends on:** T046

## Goal
Agents can read the session timeline, for example at session start to see what other agents did.

## Context
- Epic: `plans/roadmap/R041-agent-session-timeline.md`
- `/api/mcp` is hand-rolled JSON-RPC; add the tool the same way existing tools are registered in `src/app/api/mcp/route.ts`.
- Reuse `groupSessions` / `sessionsForTask` from `src/lib/sessions.ts` (T046).

## Scope
- [ ] Add a `vibedoc_get_sessions` tool with params `{ limit?: number (default 10), taskId?: string, since?: string (ISO) }`
- [ ] Output is markdown: one block per session with the header `### <actor> · <start> (<duration>)`, then the headline, then bullets for tasks (id → status), docs and ADRs
- [ ] Mention the tool in the `vibedoc_get_status` output hint as "see vibedoc_get_sessions for what happened recently" if it has a hint area

**Out of scope:** docs pages (T050).

## Files
- `src/app/api/mcp/route.ts`: tool definition and handler

## Acceptance criteria
- [ ] `tools/list` includes `vibedoc_get_sessions` with a JSON schema
- [ ] Calling it with no args returns the last 10 sessions as markdown
- [ ] `taskId` and `since` filters work. When nothing matches, it returns a clear "No sessions" message

## Verify
```bash
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_sessions","arguments":{"limit":3}}}' | jq -r '.result.content[0].text'
```
