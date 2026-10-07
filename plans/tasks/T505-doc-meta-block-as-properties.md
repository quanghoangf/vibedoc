# T505: Show a task's or epic's meta block as properties in /docs
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Phase:** R095 — UI enhancements
**Size:** L (half a day)
**Covers:** S2

## Goal
Opening a task file (e.g. `plans/tasks/T216-….md`) in /docs shows `**Status:** 👀 Review **Phase:** R078 … **Size:** … **Depends on:** …` as one run-on plain-text paragraph, because the `**Key:** Value` block under the H1 is ordinary markdown to the renderer. Show it as property rows, like the board's task panel, and take it out of the rendered body.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- The block is already defined in one place: contiguous `**Key:** Value` lines directly under the H1, blank lines between H1 and block tolerated — `roadmapMetaEnd()` + `META_LINE` in `src/lib/core.ts:3089`, used by `parseTaskFile` (`core.ts:598`) and `parseRoadmapFile`. Today it is private to core.
- /docs properties come only from YAML frontmatter: `DocProperties` (`src/components/docs/DocProperties.tsx`) renders them with `PropertyRows` (`src/components/shared/ItemPanelHeader.tsx:18`); `DocViewer` strips frontmatter with `stripFrontmatter()` before rendering (`src/components/docs/DocViewer.tsx:110`).
- The board already renders and edits these fields: `TaskStatusField`, `TaskOwnerField`, `TaskSizeField`, `TaskPriorityField`, `TaskDueField` in `src/components/board/TaskFields.tsx` (optimistic `updateTaskFields` + rollback toast → `/api/tasks/update` → `updateTaskMeta`, which rewrites only the H1 + meta block). Reuse them; don't build new pickers.
- Pure libs never import values from each other; core imports them (MEMORY.md).

## Scope
- [ ] Pure `src/lib/meta-block.ts`: `parseMetaBlock(raw) → { entries: {key, value}[], start, end }` and `stripMetaBlock(raw)`, same rule as `roadmapMetaEnd` (after frontmatter, ignores code fences). Core's `roadmapMetaEnd` delegates to it, so there is one definition
- [ ] `DocViewer`: render the body without the meta block (after `stripFrontmatter`) and pass the entries to `DocProperties`
- [ ] `DocProperties`: meta entries become rows above the frontmatter rows
  - Task files (`plans/tasks/T*.md`): Status, Owner, Size, Priority, Due use the `TaskFields` components (task looked up from AppContext `board` by id), so they are editable exactly like on the board
  - Phase / Parent / Depends on / Tasks → id chips that open the item (`/roadmap?item=`, `/board?task=`); Started / Done → formatted dates (`useFormat`)
  - Epic files (`plans/roadmap/R*.md`): same rows, read-only except what `updateRoadmapItem` already supports if trivial
  - Unknown keys → plain text row (`data-user-content`)
- [ ] Split / editor view still shows the raw lines; an edit made from a row reaches the open buffer (follow how `DocProperties` already handles `PUT /api/docs {properties}`)
- [ ] Labels for known keys in `src/i18n/docs.ts` (en + vi)

**Out of scope:** bold `Key:` lines further down a doc's body, adding new meta keys from /docs

## Files
- `src/lib/meta-block.ts`, `src/lib/meta-block.check.mts` — new
- `src/lib/core.ts` — `roadmapMetaEnd` uses `parseMetaBlock`
- `src/components/docs/DocViewer.tsx`, `src/components/docs/DocProperties.tsx`
- `src/i18n/docs.ts`
- `e2e/doc-meta-properties.mjs` — new; copy setup from `e2e/docs-lint.mjs`

## Acceptance criteria
- [ ] Open a task file in /docs → Status, Phase, Size, Depends on, Covers, Owner, Due, Started show as separate rows; the run-on paragraph is gone from the body
- [ ] Change Status from the row → the file's `**Status:**` line changes, the board card moves, the row shows the new value; a failed update rolls back with the existing toast
- [ ] Phase chip opens the epic on /roadmap; Depends on chip opens that task
- [ ] An epic file shows Parent, Status, Order, Tasks as rows
- [ ] A doc without a meta block renders exactly as before; a `**Key:**` line inside a code fence or lower in the body is untouched
- [ ] Board and roadmap parsing unchanged on this repo (same tasks/epics/statuses)

## Verify
```bash
node src/lib/meta-block.check.mts
node src/lib/roadmap-health.check.mts
pnpm build
PORT=3195 pnpm dev   # separate terminal
BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright node e2e/doc-meta-properties.mjs
```

## Manual tests
_Auto: `e2e/doc-meta-properties.mjs` passed 2026-10-07, 3 runs in a row (items below marked [x] are what it proved). `pnpm build` ok, lint 11 errors (baseline), `meta-block` / `roadmap-health` / `i18n` checks ok; `/api/tasks` and `/api/roadmap` output byte-identical before/after the core change on this repo._
### Steps
- [x] S2 — WHEN a task or epic file is opened in /docs → THEN its meta lines show as property rows, not as one paragraph
- [x] Open a task file in /docs → Status, Phase, Size, Depends on, Covers, Owner, Due, Started are rows; the body starts at the H1 + first section, a `**Key:**` line lower down and one inside a code fence still render in the body
- [x] Change Status from the row → the file's `**Status:**` line, the board and the row change; the Split editor's buffer shows the new line; a failed move shows "Could not move …" and the row rolls back
- [x] Phase chip → /roadmap?item=R…; Depends on chip → /board?task=T…
- [x] Open an epic file → Parent, Status, Order, Tasks are rows (Tasks ids are chips)
- [ ] Open `docs/architecture/02-high-level-design/HLD.md` (or MEMORY.md) → "Last updated" is now a plain row and no longer a body line (same rule as task files: any `**Key:** Value` block right under the H1). Decide if that is wanted for ordinary docs
- [ ] Owner / Size / Priority / Due rows on a task file open the same pickers as the board panel and look right; a task file without those lines still offers them
### Regression risk
- [ ] A `docs/` file with frontmatter: priority picker and "Add a property" still work, frontmatter rows show under the meta rows
- [ ] Drag a card on /board in one tab while /docs is open in another → the docs list and lint panel don't flicker (task moves now also emit `doc_updated`)
