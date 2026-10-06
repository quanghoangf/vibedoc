# T219: Docs and file explorer in Vietnamese
**Status:** 👀 Review
**Phase:** R078 — i18n support
**Size:** M (2–3 hrs)
**Depends on:** T215, T217
**Covers:** S1
**Owner:** ai:claude-code
**Due:** 2026-10-09
**Started:** 2026-10-06

## Goal
With Tiếng Việt chosen, every piece of interface text in this area is Vietnamese: headings, buttons, menus, dialogs, empty states, toasts, tooltips, `aria-label`s and placeholders. English looks exactly as it does today.

## Context
- Epic: `plans/roadmap/R078-i18n-support.md`
- Pattern from T215: messages in `src/i18n/docs.ts` (`en` as const + `vi: Messages<typeof en>`), registered in `src/i18n/index.ts`, read with `useT()` from `src/context/LanguageContext.tsx`. A missing `vi` key fails the build.
- Not translated: user content (doc text, task/epic titles, entry bodies, custom status names), file paths, ids (T215, R078, E012), keyboard keys, "VibeDoc", and anything MCP or the agent writes.
- Pure libs return English that MCP also uses; map their id/kind to a `t()` key in the component, don't translate inside the lib.
- CLAUDE.md: "No hardcoded UI text in components" (added by T215).

## Scope
- [ ] Create `src/i18n/docs.ts` and register it
- [ ] Replace the hardcoded text in the files below with `t()` (counts and plurals via `plural()`, values via `{placeholders}`)
- [ ] Add /docs (list, viewer, editor) and /explorer to `PAGES` in `e2e/i18n.mjs`, opening the panels/dialogs listed in Implementation notes so their text is checked too
- [ ] Natural Vietnamese, not word-for-word: short labels for buttons; keep the established terms consistent with `src/i18n/shell.ts`

**Out of scope:** other pages; the document text itself; dates/numbers (T216); help/shortcut text and ⌘K commands (T223).

## Files
- `src/components/docs/*.tsx`: DocsTab, DocList, DocViewer, EditorToolbar, DocOutline, DocProperties, LinkedDocs, LinkPreview, DocActionsMenu, NewDocModal (MarkdownEditor/MarkdownRenderer: only their UI chrome, never the document)
- `src/components/explorer/*.tsx`: ExplorerTab, FileCards, FileDetail, FileTree, FileTreemap

## Implementation notes
- Shared panel parts (`ItemPanelHeader` / `PropertyRows`, `PriorityBadge`, `OwnerChip`, `StatusIcon`) are translated by T217; reuse its keys, don't redo them.
- `MarkdownRenderer` renders user content: translate only its own labels (broken-link title, copy button), never the markdown.
- Open in the e2e: a doc in view and edit mode, the ⋯ menu, New document modal, the properties panel, Linked docs, /explorer with a file selected.

## Acceptance criteria
- [ ] In vi, /docs (list, viewer, editor) and /explorer show no English interface text (`e2e/i18n.mjs` passes for them)
- [ ] In en, the area is unchanged; existing e2e scripts that select by English text still pass
- [ ] `node src/lib/i18n.check.mts` passes (placeholders match)

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/i18n.mjs
```

## Manual tests
_2026-10-06 — ai · Spec: `e2e/vibedoc/T219-docs-explorer-vietnamese.spec.ts` · Auto: passed 2026-10-06_
### Steps
- [x] 🤖 With Vietnamese on, open /docs → the list says "Tìm tài liệu..." and the empty pane counts "… tệp · … tài liệu"
- [x] 🤖 Open the HLD doc → the bar shows "Đã lưu" and the tabs Xem / Chia đôi / Sửa, the side column "Liên kết tới"
- [x] 🤖 Click "Tài liệu mới" in the list → the dialog says "Chọn mẫu" and the Blank template reads "Tài liệu trống"
- [x] 🤖 Open /explorer → the views read Cây / Treemap / Bản đồ nhiệt and the pane says "Chọn một tệp để xem chi tiết"
- [ ] In Vietnamese, hover a link in a doc, open the ⋯ menu, rename a doc, add a property and switch to Sửa → the preview card, menu, dialog, properties and editor toolbar tooltips read naturally; the document text itself stays as written
- [ ] In Vietnamese, scroll the template list in Tài liệu mới → each description reads naturally; file-name templates (CLAUDE.md, Dockerfile) keep their names
### Regression risk
- [ ] In English, autosave (Saving… → Saved), live edits from an agent, broken / stale link marks and the Copy context select mode work as before
