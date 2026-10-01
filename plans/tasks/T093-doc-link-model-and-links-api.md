# T093: Doc link model: resolved links between .md files + API
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** —

## Goal
One shared, resolved link graph between every .md file in the project. Each later task builds on it: the preview, the panel, MCP and /graph. It also fixes today's false backlinks, where `findBacklinks` matches the basename as a substring.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- Links are derived from text on every request. They are never stored, same as R053.
- Every node kind takes part: doc, ADR, task, epic and entry (`fileNode()` in `src/lib/memory-graph.ts` already classifies them).
- Rules: only `src/lib/core.ts` touches the file system. Pure libs never import values from each other, because `node *.check.mts` runs them without a bundler.

## Scope
- [ ] Pure `src/lib/doc-links.ts`:
  - `extractLinks(raw, fromPath)` returns `{target, kind: 'md'|'wiki'|'code'|'id', line, text}[]`. It covers markdown links `](x.md#h)`, `[[name]]`, `[[name|alias]]`, `[[name#h]]`, backticked `*.md` paths, and `E001` / `T093` / `R056` / `ADR-004` ids.
  - It skips links inside ``` fences and external URLs.
- [ ] `resolveLink(target, fromPath, allPaths)`, in this order:
  - Resolve `./` and `../` against the source file's folder. Then try the path as root-relative.
  - For a wikilink, match on basename without `.md`. Prefer the same folder, then the shortest path.
  - For an id, use the matching file.
  - If nothing matches, return `null` (a broken link).
- [ ] `buildDocGraph(items)` returns `{nodes, edges: {from, to, line, text}[], broken: {from, target, line}[]}`. Keep one edge per from→to pair (the first line wins). Skip self-links.
- [ ] `docLinks(graph, path)` returns `{out, in, broken}` for one file.
- [ ] `getDocGraph(root)` in core.ts, with an in-memory mtime cache:
  - A `Map` keyed by root+path, holding `{mtimeMs, node, links}`. Only files whose mtime changed are re-read.
  - Deleted files drop out of the cache. Store it on `globalThis` so dev HMR keeps it.
- [ ] `GET /api/docs/links?path=` returns `{out, in, broken}`, each item with `{path, kind, label, line, text}`. An unknown path returns 404.
- [ ] `GET /api/docs/graph` returns the whole graph.
- [ ] Self-check `src/lib/doc-links.check.mts`.

**Out of scope:** UI (T094/T095/T098), MCP output (T096), removing `findBacklinks` (T096).

## Files
- `src/lib/doc-links.ts`: new, pure
- `src/lib/doc-links.check.mts`: new
- `src/lib/core.ts`: add `getDocGraph()` next to `getMemoryGraph()` (~1597). Copy its glob plus read loop and its ignore list, but keep `memory/entries` in.
- `src/app/api/docs/links/route.ts`, `src/app/api/docs/graph/route.ts`: new. Follow `src/app/api/memory/graph/route.ts` (`?root=` handling, 400/404 shapes).

## Implementation notes
- Copy the regexes for ids and backticked paths from `extractRefs()` in `memory-graph.ts`. Copy the code, don't import it (pure-lib rule). Note what `extractRefs` does not do, and fix it here: it never resolves `../`.
- The `fileNode()` label logic (H1 minus "ID: ") is also needed here. Copy it the same way.
- Fence skipping: copy how the section parsers ignore headings inside ``` (`src/lib/manual-tests.ts`).
- The cache needs a `ponytail:` note: in-process only, a second VibeDoc process keeps its own.

## Acceptance criteria
- [ ] `docs/a/x.md` with `[y](../b/y.md)` gives an edge to `docs/b/y.md`.
- [ ] `[[HLD]]` resolves to `docs/architecture/02-high-level-design/HLD.md`. An ambiguous name prefers the same folder.
- [ ] A link to a missing file shows up under `broken`, not as an edge.
- [ ] A link inside a code fence is ignored. `https://…/x.md` is ignored.
- [ ] The second `GET /api/docs/graph` on an unchanged repo re-reads no file (checked with a log or a counter in dev).
- [ ] `node src/lib/doc-links.check.mts` covers resolve (`./`, `../`, root-relative, wikilink + alias + heading, ambiguity, id), fences, broken links and dedupe.

## Verify
```bash
node src/lib/doc-links.check.mts
pnpm build && pnpm lint
curl -s 'localhost:3000/api/docs/links?path=docs/architecture/02-high-level-design/HLD.md' | head -c 600
curl -s 'localhost:3000/api/docs/graph' | head -c 300
```
