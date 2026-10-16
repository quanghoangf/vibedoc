# T529: Hub registry replaces the sibling scan
**Status:** 📋 Todo
**Phase:** R099 — Projects hub
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1

## Goal
VibeDoc remembers the projects it knows in one per-user list, and `/api/projects` returns that list instead of guessing from sibling folders. This is the base every other multi-project epic builds on.

## Context
- Epic: `plans/roadmap/R099-projects-hub.md`
- Decision: the hub list is **machine-local** (absolute roots), one JSON file `<home>/hub.json`, where `<home>` = `$VIBEDOC_HOME` or `~/.vibedoc` (the installer's folder, R076). Shape: `{ version: 1, projects: [{ id, root, name, pinned, archived, lastOpened }] }`. `id` = a slug of the folder name, de-duplicated (`web`, `web-2`).
- Decision: the hub **replaces** `discoverProjects()`'s sibling scan (listed tech debt "Multi-project scanning is naive"). The configured root (`VIBEDOC_ROOT`) is added to the hub on first read, so a single-project user sees no change.
- Trust boundary: today `rootFrom(override)` accepts any path on disk. With a hub, a `?root=` that isn't in the hub SHALL be refused (403 `not a VibeDoc project`). Demo / playground keep pinning to their copy (`isDemo()` / `isPlayground()` already gate `rootFrom` and `discoverProjects`).
- Rule: "`src/lib/core.ts` is the only place that touches the file system." The `bin/` CLI never writes `hub.json`; it talks to the running hub over HTTP (T534).
- Known ceiling, keep as is: `emitUpdate()` has no root (118 call sites), so a tab refreshes on other projects' events too. Harmless; add a `ponytail:` comment in `src/lib/events.ts`.

## Scope
- [ ] Pure `src/lib/hub.ts`: `parseHub`, `addProject(hub, root, now)` (dedupes by resolved root, allocates `id`), `removeProject`, `patchProject`, `projectFor(hub, root|id)`; no fs, no imports of other libs' values
- [ ] `src/lib/hub.check.mts` self-check
- [ ] core.ts: `hubFile()`, `readHub()` / `withHubLock(fn)` writes; `discoverProjects()` reads the hub (configured root first, archived last); delete the sibling scan
- [ ] `rootFrom()` refuses an unknown root when not demo/playground (routes already map thrown errors via `errorResponse`; add a 403 kind)
- [ ] `Project` type gains `pinned`, `archived`, `lastOpened`, `missing` (missing is filled in T532)
- [ ] CLAUDE.md: add `<home>/hub.json` to the "Outside the project" part of the write list

**Out of scope:** UI (T530, T531), adding by path (T536), the CLI (T533).

## Files
- `src/lib/hub.ts`, `src/lib/hub.check.mts` — new
- `src/lib/core.ts` — `discoverProjects()` (line ~383), `rootFrom()` (line ~191), new hub helpers next to them
- `src/app/api/projects/route.ts` — unchanged shape, now from the hub
- `src/lib/events.ts` — `ponytail:` comment on the global bus
- `CLAUDE.md`

## Implementation notes
- Copy the lock pattern from `withEntryLock` / `withRoadmapLock` in core.ts.
- `rootFrom` is sync and called by 40+ routes. Keep it sync: cache the hub's resolved roots in a module `Set`, refreshed by `readHub()` and by every hub write.
- e2e must never touch the real home: every e2e that starts the server sets `VIBEDOC_HOME=<tmp>`. Update `makeFixture` (`e2e/stub-chat.mjs`) to do it.

## Acceptance criteria
- [ ] Fresh `VIBEDOC_HOME`: `GET /api/projects` returns exactly the configured root, and `hub.json` now lists it
- [ ] Sibling folders with a `CLAUDE.md` no longer appear
- [ ] `GET /api/tasks?root=/etc` → 403; `?root=<hub project>` works as before
- [ ] Demo (`VIBEDOC_DEMO=1`) and `--demo` playground still show only their copy
- [ ] `node src/lib/hub.check.mts` passes; the existing e2e suite passes with `VIBEDOC_HOME` set

## Manual tests
- [ ] S1 — WHEN the user picks another project from the switcher → THEN its board opens, and the last page they used in that project is kept

## Verify
```bash
node src/lib/hub.check.mts
pnpm lint && pnpm build
VIBEDOC_HOME=$(mktemp -d) PORT=3081 pnpm dev:next &
curl -s localhost:3081/api/projects; curl -s -o /dev/null -w '%{http_code}\n' 'localhost:3081/api/tasks?root=/etc'
```
