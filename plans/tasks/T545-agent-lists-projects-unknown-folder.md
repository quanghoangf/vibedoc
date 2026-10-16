# T545: Agent can list projects; unknown folder is answered in words
**Status:** 📋 Todo
**Phase:** R104 — One agent connection
**Size:** S (~1 hr)
**Depends on:** T529
**Covers:** S2

## Goal
An agent can ask which projects VibeDoc knows, and when it calls from a folder that isn't in the hub it gets a clear reply on how to add it, with nothing changed.

## Context
- Epic: `plans/roadmap/R104-one-agent-connection.md`
- New MCP tool `vibedoc_list_projects` (read-only): id, name, root, groups, open tasks. Definition in `src/lib/mcp-tools.ts` (site tool pages are generated from it).
- Unknown root on `/api/mcp` (T529 makes `rootFrom` refuse it): instead of a bare 403, return a JSON-RPC result with text `This folder isn't in VibeDoc yet. Run \`npx vibedoc\` here, or add it on All projects.` for every `tools/call`; `initialize` / `tools/list` still succeed so the client stays connected.
- Acting on another project only when asked: tools keep the request's project; no `project` argument is added in this epic.
- DOMAIN_MAP / HLD say "49 tools": bump the count.

## Scope
- [ ] `vibedoc_list_projects` in `mcp-tools.ts` + case in `route.ts`
- [ ] Unknown-root reply in `route.ts`
- [ ] Update tool counts in `docs/architecture/01-overview/DOMAIN_MAP.md`, `HLD.md`

**Out of scope:** writes to other projects.

## Files
- `src/lib/mcp-tools.ts`, `src/app/api/mcp/route.ts`
- `docs/architecture/01-overview/DOMAIN_MAP.md`, `docs/architecture/02-high-level-design/HLD.md`
- `e2e/connect-agent.mjs` or a new `e2e/mcp-projects.mjs`

## Acceptance criteria
- [ ] `tools/call vibedoc_list_projects` lists every hub project
- [ ] `tools/call` with an unknown `?root=` → the add-it text, no file written anywhere, `tools/list` still works
- [ ] `pnpm --dir site test` passes (tool pages)

## Manual tests
- [ ] S2 — WHEN the agent runs in a folder that isn't in the hub → THEN the reply says so and how to add it, and changes nothing

## Verify
```bash
pnpm lint && pnpm build && pnpm --dir site test
curl -s 'localhost:3081/api/mcp?root=/tmp' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_get_status","arguments":{}}}'
```
