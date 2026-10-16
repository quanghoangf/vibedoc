# T551: Search all projects from ⌘K and a search page
**Status:** 📋 Todo
**Phase:** R107 — Cross-project search
**Size:** M (2–3 hrs)
**Depends on:** T550
**Covers:** S1

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

## Manual tests
- [ ] S1 — WHEN the user searches a term that only appears in project B while in project A → THEN the result shows B's doc and opens it in B

## Verify
```bash
node src/lib/i18n.check.mts && node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/cross-search.mjs
```
