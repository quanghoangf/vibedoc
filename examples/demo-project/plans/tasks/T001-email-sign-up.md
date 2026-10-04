# T001: Email sign-up and login
**Status:** ✅ Done
**Phase:** R003 — Accounts & sign-in
**Size:** S
**Depends on:** —
**Owner:** human
**Due:** 2026-09-12
**Started:** 2026-09-08
**Done:** 2026-09-11

## Goal
New users create an account with email + password and land on an empty list.

## Acceptance criteria
- [x] Sign-up form validates email and an 8+ character password
- [x] Session cookie is httpOnly, 30-day expiry (see [auth notes](../../docs/architecture/overview.md#auth))
