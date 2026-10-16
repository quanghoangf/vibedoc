# T546: Inbox data across every project
**Status:** 📋 Todo
**Phase:** R105 — Cross-project inbox
**Size:** M (2–3 hrs)
**Depends on:** T529
**Covers:** S1

## Goal
One endpoint returns everything waiting on the user in every hub project, newest first, so the inbox page and header badge have a single source.

## Context
- Epic: `plans/roadmap/R105-cross-project-inbox.md`
- Item kinds, all derived (nothing stored):
  - `review` — tasks with status review (`src/lib/review.ts`)
  - `needs-test` — `needsYou(...)` from `src/lib/test-review.ts` (unticked checks, unverified)
  - `failed-run` — last auto run failed
  - `blocked` — status blocked
  - `chat-waiting` — saved chats (`.vibedoc/chats/*.json`) whose status is waiting on the user (`chatStatus` / `isWaiting` in `src/lib/chats.ts`), plus live turns in `src/lib/chat-turns.ts`
- Each item: `{kind, project: {id,name}, id, title, since, href}`; `href` carries `?project=`.
- Pure `src/lib/inbox.ts` builds and sorts from per-project inputs; core gathers inputs per project (archived and missing projects skipped).

## Scope
- [ ] `src/lib/inbox.ts` + `inbox.check.mts`
- [ ] core `getInbox()`; `GET /api/inbox[?project=&group=]` (group filter via `listGroups`, T538 when present; ignore `group` before it lands)
- [ ] Emit nothing new: the page refreshes on existing SSE events

**Out of scope:** the page and badge (T547).

## Files
- `src/lib/inbox.ts`, `src/lib/inbox.check.mts` — new
- `src/lib/core.ts`, `src/app/api/inbox/route.ts` — new

## Acceptance criteria
- [ ] Two projects with a review task in A and a waiting chat in B → both items, B's first if newer, each with its project
- [ ] Archived project items are excluded
- [ ] `node src/lib/inbox.check.mts` covers every kind and the sort

## Manual tests
- [ ] S1 — WHEN a chat in project B waits on the user while they are in project A → THEN the inbox lists it with B's name, and the badge counts it

## Verify
```bash
node src/lib/inbox.check.mts
pnpm lint && pnpm build
curl -s localhost:3081/api/inbox | head
```
