# T100: e2e for doc links and graph; docs
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T094, T095, T096, T098, T099
**Done:** 2026-10-01

## Goal
The epic's "done when" is checked by one browser script, and the docs tell people and agents how links work.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- e2e pattern: `e2e/memory-browser.mjs` with helpers in `e2e/stub-chat.mjs` (`launchChrome`, `makeFixture`). Run with `PW_DIR=<dir with playwright> node e2e/<name>.mjs` against the dev server at `BASE`. Scripts fail on any console error.

## Scope
- [ ] `e2e/docs-links.mjs` with a fixture project containing:
  - `docs/a.md`, which links `[b](sub/b.md)`, `[[c]]`, a broken `[x](missing.md)` and `T001`;
  - `docs/sub/b.md`, which links back with `../a.md`;
  - `docs/c.md`;
  - `plans/tasks/T001-x.md`.
- [ ] The script checks:
  - clicking the `b` link opens b.md in /docs;
  - the panel on b.md lists a.md under Linked from;
  - the broken link is muted;
  - hovering a link shows its preview;
  - /graph shows a, b and c with edges, and clicking a selects it and dims c's unrelated edges;
  - Open goes to /docs.
- [ ] Call `vibedoc_read_doc` on a.md through `/api/mcp` and check that the `## Related files` footer lists `docs/sub/b.md`, `docs/c.md`, `T001` and Broken `missing.md`.
- [ ] Docs:
  - README: the Docs bullet (links, panel, preview), a new Graph bullet, the `vibedoc_read_doc` footer.
  - `docs/architecture/02-high-level-design/HLD.md`: `getDocGraph()` under core.ts responsibilities.
  - `memory/MEMORY.md` Key conventions: one bullet for R056 (pure `doc-links.ts` + check, mtime cache, `/graph`, force layout check, wikilink resolution order).
  - CLAUDE.md repo tree: `(app)/graph/page.tsx`.
- [ ] Mark R056 done once everything passes.

**Out of scope:** new features.

## Files
- `e2e/docs-links.mjs`: new
- `README.md`, `docs/architecture/02-high-level-design/HLD.md`, `memory/MEMORY.md`, `CLAUDE.md`
- `plans/roadmap/R056-doc-link-graph.md`: status

## Acceptance criteria
- [ ] `e2e/docs-links.mjs` passes against a fresh dev server, with no console errors.
- [ ] Every "Done when" line of R056 maps to a passing step in the script.
- [ ] The docs mention `/graph`, `[[wikilinks]]` and the `## Related files` footer.

## Verify
```bash
node src/lib/doc-links.check.mts && node src/components/graph/force-layout.check.mts
pnpm build && pnpm lint
PW_DIR=<playwright dir> BASE=http://localhost:3000 node e2e/docs-links.mjs
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Run `PW_DIR=<playwright dir> BASE=http://localhost:3000 node e2e/docs-links.mjs` → six `ok` lines and no assertion error
- [ ] Open a doc in /docs that links another doc with a relative `.md` link → clicking it opens that doc, and its Linked docs panel lists the first doc under Linked from
- [ ] In a doc with a link to a missing file → the link is grey with a dashed underline; hovering a resolved link shows a card with its title and opening text
- [ ] Open /graph → every linked doc is a dot with lines between them; click one → its edges turn accent, unrelated edges fade, and the Selected file card shows Open
- [ ] Click Open in the Selected file card → /docs opens that doc
- [ ] Read README (Docs + Graph bullets, vibedoc_read_doc row), HLD (getDocGraph) and MEMORY.md (R056 bullet) → they mention /graph, [[wikilinks]] and the ## Related files footer
### Regression risk
- [ ] The other e2e scripts (memory-browser, manual-tests-review) still pass against the same dev server
