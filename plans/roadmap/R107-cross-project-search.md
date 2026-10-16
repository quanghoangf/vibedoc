# R107: Cross-project search
**Parent:** R002
**Status:** in-progress
**Order:** 480
**Tasks:** T550, T551

The user and their agents find a doc, task or memory entry without remembering which repo it lives in.

**In scope:** search across all projects or one group from ⌘K and a search page; results grouped by project, with the kind (doc, task, epic, entry); agents can search the group from any of its projects
**Out of scope:** semantic / vector search, searching code
**Done when:** searching "rate limit" from the `web` project finds the decision doc that lives in `api`

## Scenarios
### S1: Found in another repo
- WHEN the user searches a term that only appears in project B while in project A
- THEN the result shows B's doc and opens it in B
