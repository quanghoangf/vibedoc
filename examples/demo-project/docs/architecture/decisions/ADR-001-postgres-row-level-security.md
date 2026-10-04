# ADR-001: Enforce list access with Postgres row-level security
**Status:** ✅ Accepted
**Date:** 2026-09-20

## Context
Shared lists (R004) mean every query must check who can see a list. Checking in each handler is easy to forget once there are dozens of endpoints.

## Decision
**Access rules live in Postgres RLS policies.** Each request sets `app.user_id` on its connection; policies on `lists`, `list_items` and `list_members` do the rest.

## Alternatives considered
| Option | Why rejected |
|--------|-------------|
| Checks in every handler | One missed check leaks a list |
| A shared `canAccess()` helper | Still opt-in per query |

## Consequences
- Roles (T007) become policy changes, not handler changes
- Tests must run against real Postgres, not a mock (E004)
