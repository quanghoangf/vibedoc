# T104: Split broken links from stale path mentions; make them actionable
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T103

## Goal
"Broken" means a real link (`[x](y.md)` or `[[y]]`) that points nowhere. Backticked paths to missing files are a separate, quieter signal ("stale paths"). Both counts are clickable and lead to the exact line. Today 43 of 47 "broken links" are backticked mentions and the number isn't clickable (critique P1).

## Context
- Critique snapshot: `.impeccable/critique/2026-10-01T10-02-18Z__src-app-app-graph-page-tsx.md`. Decision: split into "path mentions", don't drop them.
- Code: `src/lib/doc-links.ts` (`buildDocGraph` broken list, `docLinks`, `formatRelatedFiles`), routes `src/app/api/docs/{links,graph}/route.ts`, `src/components/docs/LinkedDocs.tsx`, `src/components/graph/DocGraph.tsx` toolbar, `src/app/api/mcp/route.ts` (vibedoc_read_doc footer), `e2e/docs-links.mjs`.

## Scope
- [ ] Lib: unresolved `code`-kind targets go to `stale` (new field) instead of `broken`; `broken` keeps md + wiki only. Update `docLinks`, graph output, `formatRelatedFiles` ("Broken:" md/wiki; "Stale paths:" code), self-check cases.
- [ ] /graph toolbar: "N broken · M stale paths" (zero parts dropped; mono counts) as a button opening a popover list grouped by file: target, line, kind; clicking a row opens the doc (and scrolls to the line if feasible via `?doc=…#L12`-style handling or highlight the link element).
- [ ] LinkedDocs: Broken section unchanged in look; add a muted "Stale paths" section below it. Rows are focusable buttons that scroll to/flash the matching element in the preview when it exists.
- [ ] Code mentions in the preview: backticked stale paths get a subtle dotted underline + title "File not found" (no click handler).
- [ ] Update e2e + MCP expectations.

## Acceptance criteria
- [ ] On this repo the toolbar shows ~4 broken and ~43 stale paths (numbers from the API), both open a list.
- [ ] `vibedoc_read_doc` footer prints "Broken:" only for md/wiki and "Stale paths:" for code.
- [ ] Clicking a broken row in /graph's list opens that doc with the link visible.
- [ ] `node src/lib/doc-links.check.mts` and `e2e/docs-links.mjs` pass.

## Verify
```bash
node src/lib/doc-links.check.mts
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
```
