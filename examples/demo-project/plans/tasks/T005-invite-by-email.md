# T005: Invite collaborators by email
**Status:** 🔨 In-progress
**Phase:** R004 — Shared lists
**Size:** M
**Depends on:** T004
**Covers:** S3
**Owner:** ai:claude-code
**Due:** 2026-10-02
**Started:** 2026-09-28

## Goal
The owner invites people by email; they get edit access once they accept.

## Context
- Endpoint shape in [lists API](../../docs/api/lists.md)
- Row-level security decides who sees what (ADR-001)

## Acceptance criteria
- [ ] `POST /lists/invite` sends an invite email with an accept link
- [ ] Accepting adds a `list_members` row with role `editor`
- [ ] Re-inviting the same email resends instead of duplicating
