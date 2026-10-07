# T006: Live sync for shared lists
**Status:** 👀 Review
**Phase:** R004 — Shared lists
**Size:** L
**Depends on:** T004
**Covers:** S2
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-09-26

## Goal
Edits by one collaborator show up for everyone on the list within a second, no reload.

## Acceptance criteria
- [x] Server pushes item changes over SSE per list
- [x] Reconnects resume from the last event id

## Manual tests
### Steps
- [x] S2 — WHEN two people have the same list open and one adds an item → THEN the other sees it within a second, without reloading
- [x] Open the same list in two browsers, add an item in one: it appears in the other within 1s
- [ ] Turn wifi off for 10s, edit, turn it back on: no duplicate items
### Regression risk
- [ ] Single-user lists still save when the SSE connection is down
- [ ] Reconnect after a write that already landed → no duplicate item (op_id, E005)
