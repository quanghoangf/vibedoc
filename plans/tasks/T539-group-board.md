# T539: Group board with every member's tasks
**Status:** ✅ Done
**Phase:** R102 — Project groups
**Size:** L (half a day)
**Depends on:** T538, T530
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-16
**Done:** 2026-10-16

## Goal
Opening a group shows one board with every member repo's tasks, each tagged with its repo and filterable by repo in one click.

## Context
- Epic: `plans/roadmap/R102-project-groups.md`
- Decision: a group is opened as `?group=<slug>` instead of `?project=` (T530). The board fetches `GET /api/tasks?group=<slug>`; core loops members' `listTasks` and adds `project: {id, name}` to each task. Task ids are only unique per repo, so the board keys tasks by `<projectId>:<taskId>`.
- Moves and edits on a group board go to the owning repo (`?root=` of `task.project`), so every existing route works unchanged.
- Reuse the Board views (`src/lib/board-views.ts`): add a `repo` filter + group-by option; don't fork the board.
- Pages that don't support groups yet (docs, memory, chat…) show "Pick a project" with the member list (shared `EmptyState`).

## Scope
- [ ] core `listGroupTasks(slug)`; `GET /api/tasks?group=`
- [ ] AppContext: `activeGroup`; board/refresh use it; SSE refresh unchanged
- [ ] Repo tag on `TaskCard` / Table row; `repo` filter + group-by in `board-views.ts` (+ check)
- [ ] Switcher lists groups above projects
- [ ] i18n strings

**Out of scope:** dependencies across repos (epic out of scope), group roadmap (T540).

## Files
- `src/lib/core.ts`, `src/app/api/tasks/route.ts`
- `src/context/AppContext.tsx`, `src/components/board/TaskCard.tsx`, `src/components/board/views/*`
- `src/lib/board-views.ts` (+ `board-views.check.mts`)
- `src/components/layout/ProjectSwitcher.tsx`
- `e2e/project-groups.mjs`

## Acceptance criteria
- [ ] Group with 5 + 3 open tasks shows 8, each tagged; filter "api" shows 3 (epic Done when)
- [ ] Moving an `api` task to done writes only `api`'s task file
- [ ] Two repos with a `T001` each both show, no key clash
- [ ] `node src/lib/board-views.check.mts` covers the repo filter

## Verify
```bash
node src/lib/board-views.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/project-groups.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] S1 — WHEN a group has two projects with 5 and 3 open tasks → THEN the group board shows all 8, each tagged with its repo (e2e/project-groups.mjs: `/board?group=shop`, both T001s show, no key clash)
- [x] Click the api chip under the filters → only api's 3 cards show; "All repos" brings web's back (e2e)
- [x] Drag api's T001 to Done → only api's task file changes, web's T001 stays todo (e2e: web's task files byte-for-byte)
- [x] Header switcher → "Groups" lists Shop above the projects; picking it opens `/board?group=shop` and the switcher reads "Shop" (e2e + screenshot)
- [x] On a group, open Docs → "Pick a project" with one "Open in <repo>" per member; picking one opens that repo's Docs and leaves the group (e2e)
- [x] Click a card on the group board → it opens in its own project (`?project=<repo>&task=T002`) (e2e)
- [x] `/board?group=no-such-group` → the default project and a toast "No group …"; `GET /api/tasks?group=` answers 404 (e2e)
- [x] Board, Table and the chip row read well at 1400px and 390px (checked on screenshots)
### Regression risk
- [x] A single project's board still drags to Done, opens the panel and ticks tests (`e2e/manual-tests-review.mjs`, `e2e/board-task-panel.mjs`), and `e2e/projects-hub.mjs` passes
