# T364: Context header on vibedoc_read_doc
**Status:** 📋 Todo
**Phase:** R087 — Agent-ready docs
**Size:** S (~1 hr)
**Depends on:** T360
**Covers:** S5

## Goal
`vibedoc_read_doc` starts with one line: path, priority, last edit, inbound link count, "propose edits with vibedoc_propose_edit". `docs.agentHeader: false` in `.vibedoc/settings.json` turns it off.

## Context
- Epic: `plans/roadmap/R087-agent-ready-docs.md`
- Everything is already in the handler's reach: `docPriority(content)` (`src/lib/doc-priority.ts`), `docLastEdit(root, path)` (core), `docLinks(graph, path)` for the footer (inbound side).

## Scope
- [ ] Pure `formatAgentHeader({path, priority, lastEdit, inbound})` in `src/lib/audience.ts` (+ check cases): e.g. `> docs/x.md · P1 · edited 2026-10-07 by ai · 3 inbound links · propose edits with vibedoc_propose_edit`; unknown parts omitted.
- [ ] `readProjectSettings` gains `agentHeader` (`docs.agentHeader`, default true).
- [ ] Handler prepends the line when on.

## Files
- `src/lib/audience.ts`, `src/lib/audience.check.mts`, `src/lib/core.ts`, `src/app/api/mcp/route.ts`, `e2e/agent-ready-docs.mjs`

## Acceptance criteria
- [ ] Header present by default with the right inbound count; gone after `docs.agentHeader: false`
- [ ] audience check covers the formatter

## Verify
```bash
node src/lib/audience.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3187 PW_DIR=. node e2e/agent-ready-docs.mjs
```

## Manual tests
- [ ] S5 — WHEN an agent calls `vibedoc_read_doc` → THEN the reply starts with one line giving path, priority, last edit and inbound link count, and it is gone after `docs.agentHeader: false`
