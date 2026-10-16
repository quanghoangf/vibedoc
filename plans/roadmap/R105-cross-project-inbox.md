# R105: Cross-project inbox
**Parent:** R002
**Status:** in-progress
**Order:** 460
**Tasks:** T546, T547

Everything waiting on the user across all projects is in one list, so agents running in several repos don't sit blocked because nobody looked.

**In scope:** one inbox of tasks in review, chats waiting on the user, failed test runs and blocked tasks, from every project, newest first, with the project named; filter by project or group; open an item in its project in one click; the header badge counts the whole inbox
**Out of scope:** email / Slack notifications, assigning items to other people
**Done when:** with agents working in three repos, the user clears every waiting item from the inbox without opening each project first

## Scenarios
### S1: Waiting chat in another project
- WHEN a chat in project B waits on the user while they are in project A
- THEN the inbox lists it with B's name, and the badge counts it
### S2: Cleared
- WHEN the user approves a review from the inbox
- THEN it leaves the inbox and the task is done in its project
