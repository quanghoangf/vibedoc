# T366: Done-when sweep, docs, close R087
**Status:** 📋 Todo
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
- [ ] S1 — WHEN an agent fetches `/llms.txt` → THEN it gets the index with `/md/` links
- [ ] S2 — WHEN it follows a link → THEN it gets the doc as markdown without human-only parts
- [ ] S3 — WHEN it asks for a wrong path → THEN up to 5 similar docs are named
- [ ] S4 — WHEN the user picks Copy page → THEN the clipboard holds the agent view
- [ ] S5 — WHEN an agent calls `vibedoc_read_doc` → THEN the header line is there
