---
priority: P2
---
# Lists API

RPC-style JSON endpoints. Every request is scoped to the signed-in user; Postgres policies decide what they can see ([ADR-001](../architecture/decisions/ADR-001-postgres-row-level-security.md)).

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/lists/create` | `{ title }` | Caller becomes owner |
| POST | `/lists/share` | `{ list_id, enabled }` | Read-only share link (T004) |
| POST | `/lists/invite` | `{ list_id, email }` | Email invite, editor role (T005) |
| GET | `/lists/events?list_id=` | — | SSE stream for live sync (T006) |

Errors return `{ "error": { "code", "message" } }`. See the [architecture overview](../architecture/overview.md) for how the pieces fit.
