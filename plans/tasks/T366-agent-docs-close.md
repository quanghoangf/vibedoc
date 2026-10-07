# T366: Done-when sweep, docs, close R087
**Status:** ✅ Done
**Owner:** ai:claude-code
**Done:** 2026-10-07
**Phase:** R087 — Agent-ready docs
**Size:** S (~1 hr)
**Depends on:** T362, T363, T364, T365
**Covers:** S1, S2, S3, S4, S5

## Goal
Prove the Done-when end to end: with only `curl`, an agent reads `/llms.txt`, follows a link, gets the doc without its human-only parts; `vibedoc_read_doc` on a wrong path suggests the right one.

## Context
- Epic: `plans/roadmap/R087-agent-ready-docs.md`

## Scope
- [ ] `e2e/agent-ready-docs.mjs`: a Done-when step chaining llms.txt → link → /md body (no human-only) → wrong-path suggestion.
- [ ] MEMORY.md Key conventions: one R087 bullet; CLAUDE.md repo structure: `/llms.txt`, `/md/` routes.
- [ ] Set R087 `**Status:** done` once every task is done.

## Files
- `e2e/agent-ready-docs.mjs`, `memory/MEMORY.md`, `CLAUDE.md`, `plans/roadmap/R087-agent-ready-docs.md`

## Acceptance criteria
- [ ] e2e passes; every check script of the epic passes; build + lint pass

## Verify
```bash
for f in audience similar-paths llms-txt i18n shortcuts; do node src/lib/$f.check.mts; done
pnpm lint && pnpm build
BASE=http://localhost:3187 PW_DIR=. node e2e/agent-ready-docs.mjs
```

## Manual tests
_2026-10-07 — ai · e2e: `e2e/agent-ready-docs.mjs` (passed)_
### Steps
- [x] S1 — `curl http://localhost:3333/llms.txt` → the index with `/md/` links, specs and open epics
- [x] S2 — `curl` one of its links → the doc as markdown without human-only parts
- [x] S3 — `curl` a misspelt `/md/` path → up to 5 similar docs
- [x] S4 — ⋯ → Copy page on a doc → the clipboard holds the agent view
- [x] S5 — `vibedoc_read_doc` → the reply starts with the context line
- [ ] Point a real agent with no MCP (e.g. a plain `curl`-only session) at /llms.txt and ask it a question about the project → it finds and reads the right doc
### Regression risk
- [ ] Agents connected over MCP still read docs as before (plus the header line)
