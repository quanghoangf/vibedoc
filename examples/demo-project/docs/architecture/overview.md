---
priority: P1
owner: platform
---
# Architecture overview

Listly is one Next.js app talking to one Postgres database. There is no separate API service.

## Components
| Part | Where | Notes |
|------|-------|-------|
| Web app | Next.js App Router | Server actions for writes |
| API | `/api/*` routes | Shape documented in [lists API](../api/lists.md) |
| Database | Postgres 16 | Access is enforced by row-level security, see [ADR-001](decisions/ADR-001-postgres-row-level-security.md) |
| Live sync | SSE per list | Built in T006 |
| Worker | Node cron process | Fires reminders (T009) |

## Auth
Sessions are httpOnly cookies with a 30-day expiry. Password reset tokens are hashed at rest (E002). Google sign-in links accounts only by verified email (T003).

## Data model
- `users`, `lists`, `list_items`, `list_members (list_id, user_id, role)`
- Every timestamp is `timestamptz`, UTC (E003)

Product context lives in [[sharing]].
