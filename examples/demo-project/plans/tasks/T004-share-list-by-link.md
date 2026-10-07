# T004: Share a list by link
**Status:** ✅ Done
**Phase:** R004 — Shared lists
**Size:** M
**Depends on:** T001
**Covers:** S1
**Owner:** human
**Due:** 2026-09-26
**Started:** 2026-09-22
**Done:** 2026-09-25

## Goal
The owner of a list can turn on a read-only share link.

## Acceptance criteria
- [x] Links use an unguessable 128-bit token, revocable from list settings
- [x] Spec: [sharing](../../docs/product/sharing.md)

## Manual tests
### Steps
- [x] S1 — WHEN an owner turns on the share link and sends it → THEN anyone with the link sees the list, read-only
- [x] Turn the link off → the old link shows "This list isn't shared"
### Regression risk
- [x] Private lists still need a login
