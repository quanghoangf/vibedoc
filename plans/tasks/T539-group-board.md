# T539: Group board with every member's tasks
**Status:** 📋 Todo
**Phase:** R102 — Project groups
**Size:** L (half a day)
**Depends on:** T538, T530
**Covers:** S1

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

## Manual tests
- [ ] S1 — WHEN a group has two projects with 5 and 3 open tasks → THEN the group board shows all 8, each tagged with its repo

## Verify
```bash
node src/lib/board-views.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/project-groups.mjs
```
