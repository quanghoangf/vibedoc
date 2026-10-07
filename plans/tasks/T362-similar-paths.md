# T362: Wrong doc path suggests up to 5 similar docs
**Status:** 📋 Todo
**Phase:** R087 — Agent-ready docs
**Size:** S (~1 hr)
**Depends on:** T361
**Covers:** S3

## Goal
A miss on `/md/<path>` or `vibedoc_read_doc` names up to 5 docs the agent probably meant, instead of a bare error.

## Context
- Epic: `plans/roadmap/R087-agent-ready-docs.md`
- Decided: use `tokenize` from `src/lib/recall.ts`; don't touch `searchDocs` (R088 rewrites it in parallel).
- Pure libs never value-import each other: `similarPaths(query, paths, tokenize)` takes the tokenizer as a parameter; core.ts passes it in.

## Scope
- [ ] `src/lib/similar-paths.ts`: `similarPaths(query, paths, tokenize, n = 5)` — score by shared tokens of the query vs each path (basename hits weigh more), ties by shorter path; nothing scored → [].
- [ ] `src/lib/similar-paths.check.mts`.
- [ ] `core.ts`: `suggestDocs(query, root)` over `listDocs()` paths.
- [ ] `/md/` 404 body: `Doc not found: <path>` + `Did you mean:` list of `/md/<p>` links.
- [ ] `vibedoc_read_doc`: catch `readDoc`'s not-found and rethrow with the suggestions.

**Out of scope:** changing `readDoc`'s fuzzy fallback or `searchDocs`.

## Files
- `src/lib/similar-paths.ts` (+ check), `src/lib/core.ts`, `src/app/md/[...path]/route.ts`, `src/app/api/mcp/route.ts`, `e2e/agent-ready-docs.mjs`

## Acceptance criteria
- [ ] `node src/lib/similar-paths.check.mts` passes
- [ ] `/md/docs/archtecture-overview.md` (typo) → 404 listing the real doc first, at most 5 lines
- [ ] `vibedoc_read_doc { query: "<typo>" }` error names the right doc

## Verify
```bash
node src/lib/similar-paths.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3187 PW_DIR=. node e2e/agent-ready-docs.mjs
```

## Manual tests
- [ ] S3 — WHEN an agent asks `/md/` or `vibedoc_read_doc` for a doc that doesn't exist → THEN the answer names up to 5 similar docs
