# T131: Docs + e2e for cross-agent memory
**Status:** ✅ Done
**Phase:** R052 — Cross-agent memory
**Size:** M
**Depends on:** T129, T130
**Owner:** human
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
The epic's Done-when is proven end to end: Claude Code memory imported into entries ends up in `AGENTS.md`, where Cursor reads it. Agents and people can also read how import and export work.

## Context
- Epic: `plans/roadmap/R052-cross-agent-memory.md`
- e2e pattern: `e2e/memory-safe-updates.mjs` / `e2e/memory-cleanup.mjs` use real routes on a mktemp fixture with only `/api/projects` stubbed. Run with `PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/<name>.mjs`.
- The Claude Code folder for a fixture root is `~/.claude/projects/<claudeProjectSlug(fixtureRoot)>/memory`. A mktemp root gives a unique slug, so the test can create and then **remove** that folder without touching real memory. If the dev server was started with `CLAUDE_CONFIG_DIR`, use that path instead of `~/.claude`.

## Scope
- [x] `e2e/cross-agent-memory.mjs`:
  1. Write 2 Claude Code memory files and a `MEMORY.md` index into the fixture's Claude Code folder. A preview through `/api/mcp?root=` shows 2 new and writes nothing
  2. Apply → `/memory` lists both entries live (SSE). Their files carry `**Source:** claude-code:<name>`
  3. Apply again → 2 unchanged
  4. The fixture `AGENTS.md` has hand-written text. Export → the block contains both summaries and the hand-written text is intact. A second export → unchanged
  5. Clean up the `~/.claude/projects/<slug>` folder in a `finally`
- [x] Docs:
  - [x] `docs/architecture/mcp-tools.md` and `docs/architecture/03-services/mcp-server/TOOLS.md`: `vibedoc_import_memory`, `vibedoc_export_memory`, and the `Source:` line in `vibedoc_get_entries`
  - [x] `docs/architecture/04-data/DATA.md`: `AGENTS.md` / `CLAUDE.md` move from "never modifies" to "written: managed block only"; add the `**Source:**` entry field and the read-only `~/.claude/projects/<slug>/memory` source
  - [x] `CLAUDE.md` "No database" list of written files: the managed block in `AGENTS.md` / `CLAUDE.md`
  - [x] `README.md` tool table: the two new tools and the updated tool count
  - [x] `memory/MEMORY.md` Key conventions: one line on R052

**Out of scope:** new behaviour. If the e2e finds a bug, fix it here and note it.

## Files
- `e2e/cross-agent-memory.mjs`: new
- the docs listed above

## Acceptance criteria
- [x] The e2e passes against `pnpm dev` and against `pnpm build && pnpm start`, and leaves no folder behind in `~/.claude/projects`
- [x] The docs match the shipped tool schemas (names, `apply` default, block markers, type map)
- [ ] Manual: after importing this repo's real Claude Code memory and exporting, a Cursor chat in this repo answers a question using one of the imported conventions
- [x] Every `*.check.mts` passes; lint is no worse than the baseline

## Verify
```bash
for f in src/lib/*.check.mts src/components/*/*.check.mts; do node $f || echo FAIL $f; done
pnpm lint && pnpm build
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/cross-agent-memory.mjs
ls ~/.claude/projects | grep -i tmp || echo clean
```
