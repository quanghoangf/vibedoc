# T531: All projects page: pin, rename, archive, remove
**Status:** 📋 Todo
**Phase:** R099 — Projects hub
**Size:** M (2–3 hrs)
**Depends on:** T530
**Covers:** S1, S3

## Goal
`/projects` lists every project in the hub with what needs the user, and lets them pin, rename, archive or remove a project without touching its files.

## Context
- Epic: `plans/roadmap/R099-projects-hub.md`
- Row: display name, path (muted), last opened, open tasks, needs-you count (`countNeedsYou` in `src/lib/test-review.ts`, plus tasks in review). Pinned first, then by `lastOpened`; archived in a collapsed "Archived (N)" group.
- Rename = display name only (`hub.json`), never the folder. Remove = drop the hub entry; nothing in the folder changes; Undo via `undoToast()` (`components/ui/toast.tsx`), restoring the same entry.
- Counts per project come from one `GET /api/projects?counts=1` (core loops the hub, reuses `listTasks`), so the page doesn't fire N requests.
- R083: an empty hub never happens (the configured root is always in it), but a hub with only archived projects shows the shared `EmptyState`.
- Rule: text in `src/i18n/projects.ts` (`en` + `vi`), registered in `src/i18n/index.ts`.

## Scope
- [ ] Route `src/app/(app)/projects/page.tsx` + sidebar entry + `PAGE_HELP` keys in `src/lib/shortcuts.ts`
- [ ] Row actions: Open, Pin/Unpin, Rename (inline), Archive/Unarchive, Remove (+ Undo)
- [ ] `POST /api/projects/update {id, patch}` and `/remove {id}` / `/restore {entry}` → core hub writes + `emitUpdate("projects_updated")`
- [ ] The current project cannot be removed (button disabled with a tooltip)
- [ ] Add `/projects` to `e2e/i18n.mjs` and `e2e/empty-states.mjs` route lists (both find routes from the folder; check they pass)

**Out of scope:** adding projects (T536), missing folders (T532), portfolio stats (T549).

## Files
- `src/app/(app)/projects/page.tsx`, `src/components/projects/ProjectRow.tsx` — new
- `src/app/api/projects/{update,remove,restore}/route.ts` — new
- `src/lib/core.ts` — `updateHubProject`, `removeHubProject`, `restoreHubProject`
- `src/i18n/projects.ts`, `src/i18n/index.ts`, `src/lib/shortcuts.ts`
- `e2e/projects-hub.mjs` — extend

## Acceptance criteria
- [ ] Three fixture repos in one hub: all three listed with their open-task counts; Open switches to each (epic Done when)
- [ ] Remove → row gone, folder byte-for-byte unchanged (e2e hashes it), Undo brings it back
- [ ] Rename changes the switcher label, not the folder
- [ ] Pinned rows sort first; archived rows are hidden from the switcher
- [ ] `node src/lib/i18n.check.mts`, `e2e/i18n.mjs`, `e2e/empty-states.mjs` pass

## Manual tests
- [ ] S1 — WHEN the user picks another project from the switcher → THEN its board opens, and the last page they used in that project is kept
- [ ] S3 — WHEN the user removes a project from the hub → THEN it leaves the list and nothing in its folder changes

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/projects-hub.mjs
BASE=http://localhost:3081 PW_DIR=. node e2e/i18n.mjs
```
