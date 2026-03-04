# T011: Extract docs components — DocList, DocViewer, DocsTab
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** S (1 hr)
**Depends on:** T009

## What to build
Extract the docs tab into DocList (search + file tree), DocViewer (content display), and DocsTab (layout wrapper).

## Scope
- [x] Create `src/components/docs/DocList.tsx` — search input + grouped file list
- [x] Create `src/components/docs/DocViewer.tsx` — path breadcrumb + MarkdownRenderer
- [x] Create `src/components/docs/DocsTab.tsx` — flex layout combining both

## Acceptance criteria
- [x] Doc search works
- [x] Clicking a doc opens it in the viewer
- [x] Markdown renders with marked

## Definition of done
Docs tab shows list, search filters it, clicking a doc shows full rendered markdown.
