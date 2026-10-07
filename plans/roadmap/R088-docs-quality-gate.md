# R088: Docs quality gate
**Parent:** R003
**Status:** planned
**Order:** 180
**Tasks:** —

The agent and the user see what is wrong with the docs in one place, and doc search ranks whole files instead of matching substrings line by line. Adapted from Fern's `fern check` / `docs link check` and its ranked search, without a CLI or a search service.

**In scope:** ranked `searchDocs` reusing `src/lib/recall.ts` tokenizing and weights (title > heading > body) and the doc graph's mtime cache, same `SearchResult` shape; pure `src/lib/doc-lint.ts` → `getDocLint()` in core: broken links and stale paths (R056), unparseable frontmatter, no H1, empty doc, orphan doc, `parseSpec` errors, broken `## Spec changes`, agent-only notes naming missing paths; levels error / warn; `GET /api/docs/lint`, new MCP `vibedoc_check_docs { path? }`, a lint line + panel on /docs that opens each issue; `/vibedoc:work` calls it before marking a docs task done
**Out of scope:** a `vibedoc check` CLI for CI (later epic), vector search, auto-fixing
**Done when:** `vibedoc_check_docs` on this repo lists the same broken links the graph shows plus the other checks, and a search for a doc's title returns that doc first

## Scenarios
### S1: One lint call
- WHEN an agent calls `vibedoc_check_docs`
- THEN it gets every doc issue grouped by file with level, rule and line, and a clean project says so in one line
### S2: Lint panel
- WHEN the user opens /docs on a project with issues
- THEN a line shows "N errors · M warnings", and clicking an issue opens the doc at that spot
### S3: Ranked search
- WHEN anyone searches docs for words in a doc's title
- THEN that doc ranks above docs that only mention the words in the body, and repeated searches don't re-read unchanged files
