# T547: Inbox page, whole-inbox badge and inline approve
**Status:** 📋 Todo
**Phase:** R105 — Cross-project inbox
**Size:** M (2–3 hrs)
**Depends on:** T546, T538
**Covers:** S1, S2

## Goal
`/inbox` lists every waiting item across projects, filterable by project or group; the header badge counts the whole inbox; a review can be approved right there.

## Context
- Epic: `plans/roadmap/R105-cross-project-inbox.md`
- Rows: kind icon, title, project chip, age; click = open in its project (`href`). Approve / Send back on review rows call `POST /api/tasks/review?root=<owner>` (existing route).
- Header badge today counts waiting chats (`(n) VibeDoc` title too). It becomes the inbox total; the per-project sidebar "Agents" section is unchanged.
- Empty inbox = shared `EmptyState` ("Nothing is waiting on you").
- Rule: i18n `src/i18n/inbox.ts`; add `/inbox` to `PAGE_HELP`.

## Scope
- [ ] `src/app/(app)/inbox/page.tsx` + sidebar entry + key in `shortcuts.ts`
- [ ] Filters: project, group, kind (URL state, `history.replaceState`)
- [ ] Inline Approve / Send back (note) for review rows
- [ ] Header badge + document title from `/api/inbox` count
- [ ] Add to `e2e/i18n.mjs` / `e2e/empty-states.mjs` route lists

**Out of scope:** notifications outside the browser.

## Files
- `src/app/(app)/inbox/page.tsx`, `src/components/inbox/InboxRow.tsx` — new
- `src/components/layout/AppHeader.tsx`, `src/lib/shortcuts.ts`
- `src/i18n/inbox.ts`, `src/i18n/index.ts`
- `e2e/inbox.mjs` — new

## Acceptance criteria
- [ ] While on project A, a waiting chat in B shows in the inbox with B's name and in the badge (epic S1)
- [ ] Approve a review in the inbox → row disappears, the task file in its repo is done (S2)
- [ ] Clear all items of three fixture projects from the inbox without opening any project (epic Done when)
- [ ] `e2e/i18n.mjs`, `e2e/empty-states.mjs` pass

## Manual tests
- [ ] S1 — WHEN a chat in project B waits on the user while they are in project A → THEN the inbox lists it with B's name, and the badge counts it
- [ ] S2 — WHEN the user approves a review from the inbox → THEN it leaves the inbox and the task is done in its project

## Verify
```bash
node src/lib/i18n.check.mts && node src/lib/shortcuts.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3081 node e2e/inbox.mjs
```
