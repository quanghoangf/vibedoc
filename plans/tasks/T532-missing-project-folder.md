# T532: Missing project folder: Locate or Remove
**Status:** 📋 Todo
**Phase:** R099 — Projects hub
**Size:** S (~1 hr)
**Depends on:** T531
**Covers:** S2

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

## Manual tests
- [ ] S2 — WHEN a project's folder was moved or deleted → THEN All projects marks it missing and offers Locate or Remove, and the other projects still work

## Verify
```bash
node src/lib/hub.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/projects-hub.mjs
```
