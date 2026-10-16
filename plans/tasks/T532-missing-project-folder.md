# T532: Missing project folder: Locate or Remove
**Status:** ✅ Done
**Phase:** R099 — Projects hub
**Size:** S (~1 hr)
**Depends on:** T531
**Covers:** S2
**Owner:** ai:claude
**Due:** 2026-10-17
**Started:** 2026-10-16
**Done:** 2026-10-16

## Goal
A project whose folder was moved or deleted shows as missing and can be pointed at its new place, while every other project keeps working.

## Context
- Epic: `plans/roadmap/R099-projects-hub.md`
- `missing` is derived on read (`fs.stat(root)` fails or isn't a directory), never stored.
- Locate = type the new absolute path; core checks it is a directory and keeps the same `id`, so links and per-project last page survive.
- A request with `?root=` of a missing project → 404 `project folder not found` (not 500), so other tabs fail cleanly.

## Scope
- [ ] core `discoverProjects()` fills `missing`
- [ ] All projects row: "Missing" chip, Locate (path input) and Remove
- [ ] `POST /api/projects/locate {id, root}` → `patchProject` root; refuses a non-directory or a root another entry has
- [ ] Switcher shows missing projects disabled
- [ ] i18n strings in `src/i18n/projects.ts`

**Out of scope:** a native folder picker.

## Files
- `src/lib/hub.ts` (+ check) — `relocateProject`
- `src/lib/core.ts`, `src/app/api/projects/locate/route.ts` — new route
- `src/components/projects/ProjectRow.tsx`, `src/components/layout/ProjectSwitcher.tsx`
- `e2e/projects-hub.mjs` — extend

## Acceptance criteria
- [ ] Renaming a fixture folder on disk → its row shows Missing; the other projects open normally
- [ ] Locate with the new path → row back to normal, same id, its tasks load
- [ ] Locate with a file path or a taken root → error in words, nothing saved

## Verify
```bash
node src/lib/hub.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/projects-hub.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] Rename a hub project's folder on disk, open All projects → its row shows a red "Missing" chip, the path struck through and a Locate button
- [x] Open the header switcher → that project is disabled and reads "folder missing"; other projects still open
- [x] `GET /api/tasks?root=<old path>` → 404 "project folder not found", not 500
- [x] Locate with a file path → "not a folder: …" under the field; with another project's folder → "another project already uses …"; the hub entry is unchanged
- [x] Locate with the new folder → row back to normal, same id, "1 open task"; its board loads
### Regression risk
- [x] Other projects keep working while one is missing; Remove still works on a missing row (same button as T531)
