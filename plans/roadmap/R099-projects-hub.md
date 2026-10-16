# R099: Projects hub
**Parent:** R002
**Status:** done
**Order:** 400
**Tasks:** T529, T530, T531, T532

One VibeDoc manages every project the user works on, so they stop running one VibeDoc per repo and juggling ports and tabs.

**In scope:** an All projects page (name, path, last opened, open tasks, needs-you count); the list is remembered between runs; quick switch from the header and ⌘K; pin, rename (display name only), archive and remove a project (remove never touches the repo's files); a project whose folder was moved or deleted shows as missing, with Locate or Remove
**Out of scope:** groups (R102), importing from git URLs (R101), sharing across machines (R034)
**Done when:** a user with three repos opens one VibeDoc, sees all three on All projects and switches between them without restarting anything

## Scenarios
### S1: Switch projects
- WHEN the user picks another project from the switcher
- THEN its board opens, and the last page they used in that project is kept
### S2: Folder gone
- WHEN a project's folder was moved or deleted
- THEN All projects marks it missing and offers Locate or Remove, and the other projects still work
### S3: Remove keeps files
- WHEN the user removes a project from the hub
- THEN it leaves the list and nothing in its folder changes
