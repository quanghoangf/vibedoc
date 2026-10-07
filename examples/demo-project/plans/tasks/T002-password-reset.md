# T002: Password reset by email
**Status:** ✅ Done
**Phase:** R003 — Accounts & sign-in
**Size:** S
**Depends on:** T001
**Owner:** ai:claude-code
**Due:** 2026-09-16
**Started:** 2026-09-12
**Done:** 2026-09-15

## Goal
A forgotten password can be reset from a one-time link that expires after 1 hour.

## Acceptance criteria
- [x] Reset tokens are single-use and hashed at rest (E002)

## Manual tests
### Steps
- [x] Request a reset for a known email → the email arrives with a link valid for 1 hour
- [x] Use the link twice → the second time says it has expired
### Regression risk
- [x] Logging in with the old password fails after the reset
