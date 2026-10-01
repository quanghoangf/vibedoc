# T096: vibedoc_read_doc ends with resolved related files
**Status:** ✅ Done
**Phase:** R056 — Doc link graph
**Size:** S (~1 hr)
**Depends on:** T093
**Done:** 2026-10-01

## Goal
An agent that reads a doc learns which other files it should read next: what the doc links to and what links to it, resolved and compact. Today it only gets the substring-matched "Referenced by" lines.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- `vibedoc_read_doc` is defined at `src/app/api/mcp/route.ts:121`, with its handler at :729. It appends `## Referenced by` from `findBacklinks` (:735).
- Pattern to copy: `vibedoc_get_task` (:815) appends `withGap(await relatedEntries(task, root))`. `formatEntryLinks()` in `src/lib/memory-graph.ts` is the capped "+N more" formatter.
- `findBacklinks` (`core.ts:1564`) and `src/app/api/backlinks/route.ts` have no other users once T095 is done. Delete them here.

## Scope
- [x] Pure `formatRelatedFiles(links, cap = 10)` in `src/lib/doc-links.ts`. It outputs:
  ```
  ## Related files
  Links to: docs/…/DOMAIN_MAP.md · T093 · E004 (+3 more)
  Linked from: CLAUDE.md (L41) · docs/…/README.md (L12)
  Broken: missing.md (L8)
  Read with vibedoc_read_doc, or several at once with vibedoc_get_context { paths }.
  ```
  Omit empty lines. If there are no links at all, output nothing.
- [x] Use it in the `vibedoc_read_doc` handler in place of `## Referenced by`.
- [x] Update the tool description so it mentions the footer.
- [x] Delete `findBacklinks` and `src/app/api/backlinks/route.ts`.
- [x] Add cases to `doc-links.check.mts` for the formatter: cap, empty, broken only.

**Out of scope:** a new tool that bundles neighbours (out of epic), adding the footer to `vibedoc_get_context`.

## Files
- `src/lib/doc-links.ts`, `src/lib/doc-links.check.mts`
- `src/app/api/mcp/route.ts`: handler + description
- `src/lib/core.ts`: remove `findBacklinks`
- `src/app/api/backlinks/route.ts`: delete

## Acceptance criteria
- [x] `vibedoc_read_doc` on HLD.md ends with `## Related files`, listing resolved paths and ids. No raw line dumps.
- [x] Docs, tasks and entries are listed by path or id, so an agent can pass them straight to `vibedoc_read_doc` / `vibedoc_get_task` / `vibedoc_get_entries`.
- [x] A doc with no links has no footer.
- [x] `grep -rn findBacklinks src` is empty, and the build passes.

## Verify
```bash
node src/lib/doc-links.check.mts
pnpm build && pnpm lint
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_read_doc","arguments":{"query":"HLD"}}}' | tail -c 800
```

## Manual tests
_2026-10-01 — ai_
### Steps
- [ ] Ask an agent (or POST /api/mcp tools/call) to run vibedoc_read_doc on "CLAUDE" → the reply ends with `---` then `## Related files`, a `Linked from:` line naming README.md, T021 etc. with (L<line>), and the "Read with vibedoc_read_doc…" hint
- [ ] Run vibedoc_read_doc on "HLD" → no `## Referenced by` block and no raw line dumps; tasks show as ids (T093), docs as full paths
- [ ] Run vibedoc_read_doc on a doc with more than 10 incoming links (e.g. "CLAUDE") → the line shows 10 names then `(+N more)`
- [ ] Add `[x](missing.md)` to a scratch doc and read it → `Broken: missing.md (L<n>)`; remove the link → the Broken line is gone
- [ ] Read a doc that links nowhere and nothing links to → no `## Related files` footer at all
- [ ] Pass one id from `Linked from` to vibedoc_get_task and one path to vibedoc_read_doc → both open the right file
### Regression risk
- [ ] /docs linked docs panel (Links to / Linked from / Broken) still loads, since GET /api/backlinks was removed
- [ ] vibedoc_read_doc on a missing name still returns the usual not-found error
