# T007: Per-list roles: owner, editor, viewer
**Status:** 🚫 Blocked
**Phase:** R004 — Shared lists
**Size:** M
**Depends on:** T005
**Owner:** human
**Due:** 2026-10-12
**Started:** 2026-10-01

## Goal
Each member has a role per list. Viewers can't edit, editors can't delete the list.

## Context
Blocked until invites (T005) create membership rows.

## Acceptance criteria
- [ ] Role checks live in the RLS policies, not the handlers (ADR-001)
