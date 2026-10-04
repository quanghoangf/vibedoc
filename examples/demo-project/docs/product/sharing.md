---
priority: P0
status: in review
---
# Sharing lists

Small teams keep shopping lists, release checklists and chores in Listly. Today every list is private. This spec covers how a list becomes shared.

## Levels
1. **Share link**: anyone with the link can view (T004, shipped)
2. **Invite**: named people can edit (T005)
3. **Roles**: owner, editor, viewer per list (T007)

## Rules
- The owner can revoke a link or remove a member at any time
- Edits appear for everyone within a second (T006)
- Nobody but the owner can delete a list

Technical notes: [architecture overview](../architecture/overview.md), endpoints in [lists API](../api/lists.md). Roadmap epic: R004.
