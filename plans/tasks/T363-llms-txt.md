# T363: /llms.txt index served from the files
**Status:** 📋 Todo
**Phase:** R087 — Agent-ready docs
**Size:** M (2–3 hrs)
**Depends on:** T361
**Covers:** S1

## Goal
`GET /llms.txt` gives any agent the project's map: title, every doc section with `/md/` links and descriptions, the capability specs and the open epics. Built on request; nothing is written to the repo, no `llms-full.txt`.

## Context
- Epic: `plans/roadmap/R087-agent-ready-docs.md`
- Format follows llmstxt.org: `# <project>`, `> summary`, `## Section` + `- [name](url): description`.
- Registry descriptions come from the annotations table in `docs/REGISTRY.md` (`parseAnnotations`, private in core.ts).

## Scope
- [ ] `src/lib/llms-txt.ts`: pure `formatLlmsTxt({ title, origin, docs: {path, section, description?}[], specs, epics, section? })`; `?section=<name>` lists only that section (unknown section → list of section names).
- [ ] `src/lib/llms-txt.check.mts`.
- [ ] `core.ts`: `getLlmsIndex(root)` gathers `listDocs`, registry annotations, `listSpecs`, open epics (`listRoadmap`, items with a parent, status not done/cancelled).
- [ ] `src/app/llms.txt/route.ts`: `text/plain; charset=utf-8`, honours `?root=`, link URLs carry `?root=` when given.

**Out of scope:** `llms-full.txt`, writing the file into the repo.

## Files
- `src/lib/llms-txt.ts` (+ check), `src/lib/core.ts`, `src/app/llms.txt/route.ts` (new), `e2e/agent-ready-docs.mjs`

## Acceptance criteria
- [ ] `node src/lib/llms-txt.check.mts` passes
- [ ] `/llms.txt` lists sections, specs and open epics; a doc link fetched with curl returns that doc (T361)
- [ ] `/llms-full.txt` is 404

## Verify
```bash
node src/lib/llms-txt.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3187 PW_DIR=. node e2e/agent-ready-docs.mjs
```

## Manual tests
- [ ] S1 — WHEN an agent fetches `/llms.txt` → THEN it gets the title, every doc section with `/md/` links and descriptions, the specs and open epics, and no `llms-full.txt` exists
