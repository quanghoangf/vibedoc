# T109: Trustworthy broken and stale counts
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T108
**Done:** 2026-10-02

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

## Result
Measured on this repo with `GET /api/docs/graph`: **before 4 broken · 73 stale** (the critique's 63 plus the R056 task files written since), **after 0 broken · 15 stale**.

What dropped out, by rule (all in `src/lib/doc-links.ts`, each with a case in `doc-links.check.mts`):
- Placeholders skipped at extraction: `<…>`, `{…}`, globs, `…` / `...`, `T00N` / `NNN` / `XXX` / `YYYY` tokens (the entry and task file templates, the meetings date template, `docs/.../mcp-tools.md`).
- A leading `@` is dropped before resolving (Claude includes).
- A backticked bare name resolves when exactly one file has it (`MEMORY.md` → memory/MEMORY.md, `mcp-tools.md`, `_INDEX.md`); a bare name several files share (`craft-floor.md` in .claude/ and .github/) is not stale either, it just gets no edge. An md link still has to work as written, so it never falls back to a basename.
- Files in dot folders (.claude/skills, .impeccable/critique, .github) are passed to `buildDocGraph` as `otherPaths`: a mention of one is not a miss, but it gets no node, edge or target (the docs viewer can't open it).
- Syntax examples: a miss whose whole file name is a teaching word (a/b/c/x/y/z, path, name, slug, title, foo, bar, wikilinks, example), or the rest after an item id (`T001-x.md`, `ADR-001-title.md`), is dropped. Never one `-` part of a longer name: user-name.md, plan-b.md, an api-name wikilink, docs/old-name.md stay broken / stale (negative check cases + the e2e fixture's user-name.md link). This covers all 4 old broken links (`[[wikilinks]]` in the T094 title and T100, `[text](path.md)` and `[[name]]` in T098) and the fixture paths in T093 / T100 specs. Target-based only, never the link text, so the e2e fixture's `[x](missing.md)` stays broken.

The docs preview draws a link as dead (dashed muted) when it is a reported broken link or a skipped syntax example; a link to a dot-folder file (`.claude/skills/…`) is neither, since the file exists. "Show all N files" moves focus to the first newly shown row.

Remaining stale paths, each a path that does not exist here:
```
01-brainstorm/agent-chat-sidebar.md L70        @docs/HLD.md          outdated: HLD lives at docs/architecture/02-high-level-design/HLD.md
plans/tasks/T109-...md L11                      @docs/HLD.md          same path, quoted in this spec's Context
plans/tasks/T069-...md L51                      docs/architecture/HLD.md   outdated HLD path in the spec's example
README.md L149                                  docs/REGISTRY.md      the registry tools' file; never generated in this repo
README.md L150, plans/roadmap/R011-...md L7     REGISTRY.md           same registry file, absent
plans/tasks/T021-...md L27/28/30/33             docs/prd.md, docs/architecture/overview.md, docs/runbook.md, docs/onboarding.md
                                                                      files the doc templates create in a target project; none exist here
plans/tasks/T044-...md L51                      docs/overview.md, docs/users.md   files of the e2e fixture project, absent here
plans/tasks/T086-...md L12                      memory/entries/E001-only-core-ts-touches-the-file-system.md   example entry; this repo has no memory/entries
plans/tasks/T100-...md L28                      missing.md            the e2e fixture's broken target; can't be an example word without hiding the real one
skills/epic-breakdown/SKILL.md L17              plans/roadmap/R004-billing.md   example epic path in the skill; no such epic here
```
Every one is a real missing target: a stale path is a per-doc lint (shown in /docs Linked docs and the vibedoc_read_doc footer) and these are what a lint should say. The /graph toolbar shows broken links only ("N broken links", hidden at 0; grouped by file, most first, the first 5 files open, then "Show all N files"), so on this repo it is hidden.

## Manual tests
_2026-10-02 — ai_
### Steps
- [ ] Open /graph on this repo → no broken/stale button in the toolbar; the search box sits at the right edge
- [ ] In a scratch doc add `[x](nowhere.md)` to 6+ files, open /graph → "N broken links" button; menu groups by file, most broken first, 5 files open and a "Show all N files" row
- [ ] Arrow down to "Show all N files" and press Enter → the menu stays open and lists every file
- [ ] Open README.md in /docs → Linked docs lists Stale paths docs/REGISTRY.md and REGISTRY.md; MEMORY.md is a resolved link, not stale
- [ ] Open plans/tasks/T098-graph-page.md → `[[name]]` / `[text](path.md)` render as muted dashed (dead) links but are not counted anywhere
- [ ] Ask an agent for vibedoc_read_doc on README → the Related files footer has Stale paths but no template placeholders
### Regression risk
- [ ] A real broken md link (`[x](missing.md)`) still shows on /graph, in Linked docs and in the MCP footer
- [ ] Clicking a resolved link in the docs preview still opens the file (only unresolved links are muted)
