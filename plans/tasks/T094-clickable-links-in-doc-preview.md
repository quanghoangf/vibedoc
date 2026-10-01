# T094: Clickable .md links and [[wikilinks]] in the doc preview
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T093

## Goal
Clicking a link to another doc in the preview opens that doc inside VibeDoc. Today a relative `.md` link sends the browser to a broken URL. `[[wikilinks]]` render as links, and links that point nowhere look broken.

## Context
- Epic: `plans/roadmap/R056-doc-link-graph.md`
- Resolution comes from `GET /api/docs/links?path=` (T093). The client never re-implements `resolveLink`.
- `src/components/docs/MarkdownRenderer.tsx` runs `marked` → `sanitize()` → `dangerouslySetInnerHTML`. It has no link handling and does not know the current doc path. It is used only from `MarkdownEditor.tsx:393` (preview mode).
- `openDoc(path)` is in `src/context/AppContext.tsx:209`. Task, epic and entry targets open the way `useOpenNode` does (`src/components/memory/EntryRelated.tsx:21`).

## Scope
- [ ] Pass a `docPath` prop to `MarkdownRenderer`, threaded through `MarkdownEditor` from `DocViewer`.
- [ ] Add a `marked` inline extension for `[[name]]`, `[[name|alias]]` and `[[name#h]]`. It renders `<a data-wiki="name#h">alias-or-name</a>`.
- [ ] One delegated `onClick` on the renderer container:
  - `a[href]` that is relative and ends in `.md` (optionally `#h`), or `a[data-wiki]`: resolve through the links data and open the target with the `useOpenNode` handlers. Then scroll to `#h` if there is one.
  - `#h` alone: scroll inside the doc.
  - External links: open in a new tab.
  - ⌘/Ctrl-click: let the browser handle it.
- [ ] After render, add a `data-broken` attribute to links that the links data lists as `broken`, and style them muted with a dashed underline (`globals.css`, next to `.prose-dark a`).

**Out of scope:** hover previews (T099), the panel (T095), editing wikilinks in the editor.

## Files
- `src/components/docs/MarkdownRenderer.tsx`: `docPath` prop, wikilink extension, click delegation, broken marking
- `src/components/docs/MarkdownEditor.tsx`, `src/components/docs/DocViewer.tsx`: pass `docPath`
- `src/app/globals.css`: broken-link style
- Possibly a small `useDocLinks(path)` hook (fetch `/api/docs/links`, refetch on SSE `doc_updated` / summary change). Put it in `src/components/docs/` so T095 and T099 reuse it.

## Implementation notes
- The wikilink extension output must survive `sanitize()`. Check that `data-*` attributes are kept.
- Match a clicked link to the links data by `(line, target)` or by its raw target string. Pick one and document it in the hook. Don't resolve paths in the browser.
- Keep `openDoc` for docs. Reuse the `useOpenNode` handlers for task, epic and entry, and lift the hook out of `EntryRelated.tsx` if it is not exported.

## Acceptance criteria
- [ ] In HLD.md preview, clicking a relative link to another doc opens that doc in /docs. The URL updates and there is no full page reload.
- [ ] `[[DOMAIN_MAP]]` renders as a link and opens DOMAIN_MAP.md. `[[x|Label]]` shows "Label".
- [ ] `[a](missing.md)` is muted with a dashed underline, and clicking it does nothing (it shows a toast "Not found: missing.md").
- [ ] A link to `T093` or to a task file opens /board with that task.
- [ ] `#heading` links scroll, external links open a new tab, and ⌘-click is untouched.
- [ ] Edit mode is unchanged.

## Verify
```bash
pnpm build && pnpm lint
# open http://localhost:3000/docs?doc=docs/architecture/02-high-level-design/HLD.md (preview) and click its links
```
