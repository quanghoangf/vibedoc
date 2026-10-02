# T109: Trustworthy broken and stale counts
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T108

## Goal
Every broken link and stale path VibeDoc reports is real, so the counts mean something. Decision: stale paths are a per-doc lint — shown in /docs (Linked docs) and the MCP footer, **not** in the /graph toolbar, which shows broken links only.

## Context
- Snapshot: `.impeccable/critique/2026-10-02T06-44-54Z__src-app-app-graph-page-tsx.md` (P1 noise). Today on this repo: "4 broken · 63 stale"; most stale are template placeholders (`memory/entries/E001-<slug>.md`), bare names that exist elsewhere (`MEMORY.md` → memory/MEMORY.md), `@docs/HLD.md` includes; 3 of 4 broken are syntax examples in task specs (`[[wikilinks]]`, `[x](path.md)`, `[[name]]`).
- Code: src/lib/doc-links.ts (+check), src/app/api/docs/{links,graph}/route.ts, src/components/graph/DocGraph.tsx toolbar menu, src/components/docs/LinkedDocs.tsx, src/app/api/mcp/route.ts footer, e2e/docs-links.mjs.

## Scope
- [ ] Extraction/resolution rules (pure lib, each with a check case):
  - skip targets containing placeholders: `<…>`, `{…}`, `*`, `…`/`...`, `NNN`/`XXX`-style tokens;
  - strip a leading `@` (Claude include syntax) and resolve the rest;
  - a bare file name (no slash) resolves when exactly one file in the repo has that basename (prefer same folder first, as wikilinks do);
  - syntax examples: a link whose text or target is a placeholder word used to *teach* syntax (`path.md`, `name`, `x.md`, `wikilinks`) inside a line that also contains inline code or quotes the syntax — keep this rule narrow and covered by checks; prefer skipping links inside list items under `## Acceptance criteria` / `## Scope` only if a narrower rule can't fix this repo's 3 cases.
- [ ] /graph toolbar: broken only ("N broken links", hidden when 0). Menu grouped by file, sorted by count, first 5 files expanded, "Show all N" for the rest.
- [ ] LinkedDocs + MCP footer keep Stale paths (filtered by the new rules).
- [ ] Re-measure on this repo and write the before/after numbers in the task's Result.

## Acceptance criteria
- [ ] On this repo every remaining broken / stale entry is a real missing target (list them in the Result and justify each).
- [ ] No regression: the e2e fixture's real broken (missing.md) and stale (docs/gone.md) still report.
- [ ] /graph toolbar has no stale count.

## Verify
```bash
node src/lib/doc-links.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
curl -s localhost:3000/api/docs/graph | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.broken.length,j.stale.length)})'
```
