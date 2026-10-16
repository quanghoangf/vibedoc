# T551: Search all projects from ⌘K and a search page
**Status:** 👀 Review
**Phase:** R107 — Cross-project search
**Size:** M (2–3 hrs)
**Depends on:** T550
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-19
**Started:** 2026-10-16

## Goal
From ⌘K or `/search`, the user finds a doc, task, epic or entry in any project and opens it in its own project.

## Context
- Epic: `plans/roadmap/R107-cross-project-search.md`
- ⌘K (`CommandPalette.tsx`): after the current project's results, a section "In other projects" (debounced 200 ms, `GET /api/search?scope=all`), max 5.
- `/search?q=&scope=` page: results grouped by project with kind icons; scope select (All projects · group · this project).
- Opening a result switches project (`?project=`, T530) and opens the doc / task panel / epic / entry deep link.
- Rule: i18n `src/i18n/search.ts`; add `/search` to `PAGE_HELP` and the i18n/empty-state e2e route lists.

## Scope
- [ ] ⌘K section; `/search` page; result → deep link with project
- [ ] i18n strings, help keys

**Out of scope:** saved searches.

## Files
- `src/components/layout/CommandPalette.tsx`
- `src/app/(app)/search/page.tsx` — new
- `src/i18n/search.ts`, `src/i18n/index.ts`, `src/lib/shortcuts.ts`
- `e2e/cross-search.mjs` — new

## Acceptance criteria
- [ ] In project A, ⌘K "rate limit" shows B's doc under "In other projects"; Enter opens it in B
- [ ] `/search` with scope group lists only the group's projects
- [ ] `e2e/i18n.mjs`, `e2e/empty-states.mjs` pass

## Verify
```bash
node src/lib/i18n.check.mts && node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/cross-search.mjs
```

## Manual tests
_2026-10-16 — ai_
### Steps
- [x] S1 — WHEN the user searches a term that only appears in project B while in project A → THEN the result shows B's doc and opens it in B (e2e/cross-search.mjs: ⌘K in web → api's doc under "In other projects", Enter opens /docs in api)
- [ ] With two hub projects, press ⌘K in A and type a word only B has → "In other projects" lists B's doc with B's name on the right, then "Search all projects for …"
- [ ] Press `q` on any page → /search opens with the box focused; type a word → results grouped by project, the current one tagged "Current"
- [ ] Switch "Where to search" to a group, then to This project → only those projects' sections remain; reload keeps the query and scope
- [ ] Click a task / epic / memory entry result from another project → that project opens on the task panel / epic sheet / entry
- [ ] The /search page looks right in light and dark themes and at phone width
### Regression risk
- [ ] ⌘K in a single-project hub still shows only this project's tasks, docs and actions (no "In other projects" section)
