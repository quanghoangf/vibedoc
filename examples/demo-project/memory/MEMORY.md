# Project Memory
**Last updated:** 2026-10-03

## Current state
Accounts (R003) shipped. Shared lists (R004) are half done: share links work, live sync is in review, invites are in progress and late.

## Just completed
- T004 share a list by link
- T006 live sync moved to review, waiting on the offline manual test

## Working on now
T005 invite by email. The invite email sends; accepting does not create the `list_members` row yet.

## Up next
1. Finish T005, which unblocks T007 roles
2. Start the reminder scheduler (T009), the R005 due date is close

## Active issues
| Issue | Severity | Status |
|-------|----------|--------|
| T005 is past its due date | medium | open |
| Duplicate items after a reconnect (seen once in T006 testing) | high | investigating |

## Recent decisions
- Access control lives in Postgres RLS (ADR-001)
- Offline mode waits for the mobile app (T012 cancelled)

## Tech debt
- Reminder times in the old prototype were stored in local time; migrate before T009

## Handoff for next session
Read T005 first. The accept handler is in `app/invite/accept/route.ts` (not written yet). Use the RLS test helper from E004.
