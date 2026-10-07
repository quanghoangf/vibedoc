# R004: Shared lists
**Parent:** R001
**Status:** in-progress
**Order:** 20
**Due:** 2026-10-15
**Owner:** ai:claude-code
**Priority:** P0
**Tasks:** T004, T005, T006, T007, T008

Share a list with your team and see each other's edits live. Spec: [sharing](../../docs/product/sharing.md).

**In scope:** share links, email invites, live sync, roles, per-list activity
**Out of scope:** public lists, comments on items
**Done when:** two people can edit the same list at once without reloading

## Scenarios
### S1: Share by link
- WHEN an owner turns on the share link and sends it
- THEN anyone with the link sees the list, read-only
### S2: Live edits
- WHEN two people have the same list open and one adds an item
- THEN the other sees it within a second, without reloading
### S3: Invite by email
- WHEN an owner invites a teammate by email and they accept
- THEN the list shows up in the teammate's lists and they can edit it
