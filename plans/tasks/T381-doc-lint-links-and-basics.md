# T381: Doc lint: links, frontmatter, H1, empty + vibedoc_check_docs
**Status:** 📋 Todo
**Phase:** R088 — Docs quality gate
**Size:** M (2–3 hrs)
**Depends on:** T380
**Covers:** S1

## Goal
One call tells an agent everything wrong with the docs: `vibedoc_check_docs` and `GET /api/docs/lint` return issues grouped by file with level, rule and line. This task ships the pipeline end to end with the link and basic structure rules.

## Context
- Epic: `plans/roadmap/R088-docs-quality-gate.md`
- Decided: no CLI. MCP `vibedoc_check_docs { path? }` + `GET /api/docs/lint[?path=]` only. R090 (CLI) and R092 (doc upkeep agent) will reuse `lintDocs` / `getDocLint`, so keep them pure and documented.
- Broken links and stale paths come from the doc graph (R056: `buildDocGraph` → `broken` / `stale`), so the lint lists exactly what /graph shows.
- New MCP tools go in `src/lib/mcp-tools.ts` (`TOOLS`); the handler is a `case` in `src/app/api/mcp/route.ts`. It is read-only: add it to `DEMO_TOOLS`.
- Tool count goes 45 → 46 in DOMAIN_MAP.md, HLD.md, README.md.

## Scope
- [ ] Pure `src/lib/doc-lint.ts`: types `LintLevel`, `LintRule`, `LintIssue`, `DocLint`; `lintDocs(files, graph, opts?)`, `summarizeLint`, `formatLint`.
- [ ] Rules: `broken-link` (error, from `graph.broken`), `stale-path` (warn, from `graph.stale`), `bad-frontmatter` (error: a file starting with `---` and no closing `---`, or a line inside that is neither `key: value`, a list item, an indented line, a comment nor blank), `no-h1` (warn), `empty-doc` (warn: nothing but whitespace after the frontmatter).
- [ ] `getDocLint(root, path?)` in core.ts over `readMarkdownFiles` (T380) + `getDocGraph`.
- [ ] `GET /api/docs/lint` route.
- [ ] MCP `vibedoc_check_docs`: grouped by file, `L12 error broken-link: …`; a clean project → one line `✅ Docs check: no issues in N files`.
- [ ] `src/lib/doc-lint.check.mts`; `docs/architecture/mcp-tools.md` documents the tool; tool count 46.

**Out of scope:** orphan / spec rules (T382), the /docs panel (T383), agent-only notes naming missing paths (needs R087's `<!-- agent-only -->` blocks, not on this branch; a follow-up once R087 merges).

## Files
- `src/lib/doc-lint.ts`, `src/lib/doc-lint.check.mts` — new
- `src/lib/core.ts` — `getDocLint`
- `src/app/api/docs/lint/route.ts` — new; copy `src/app/api/docs/links/route.ts`
- `src/lib/mcp-tools.ts`, `src/app/api/mcp/route.ts`
- `docs/architecture/mcp-tools.md`, `docs/architecture/01-overview/DOMAIN_MAP.md`, `docs/architecture/02-high-level-design/HLD.md`, `README.md`

## Implementation notes
Shape other epics depend on:
```ts
type LintIssue = { path: string; line: number; level: 'error' | 'warn'; rule: LintRule; message: string; target?: string }
type DocLint = { files: number; errors: number; warnings: number; issues: LintIssue[] } // issues sorted by path, line
lintDocs(files: { path: string; raw: string }[], graph: DocGraph, opts?: { path?: string }): LintIssue[]
```
`target` carries the raw link target for link rules, so the UI can reveal it with the existing `?link=` (MarkdownRenderer `DocLinks`).

## Acceptance criteria
- [ ] On this repo `vibedoc_check_docs` lists the same broken links as `GET /api/docs/graph`'s `broken` (count equal).
- [ ] `vibedoc_check_docs { path }` lists only that file's issues.
- [ ] Check covers each rule plus a clean case.

## Verify
```bash
node src/lib/doc-lint.check.mts
pnpm lint && pnpm build
PORT=3188 pnpm dev   # then: curl -s 'localhost:3188/api/docs/lint' | head -c 600
```
