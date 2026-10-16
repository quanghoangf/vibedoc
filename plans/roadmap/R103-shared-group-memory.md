# R103: Shared group memory
**Parent:** R002
**Status:** in-progress
**Order:** 440
**Tasks:** T541, T542

What an agent learns in one repo of a group (a convention, a gotcha, a decision) reaches agents working in the other repos, so the same lesson isn't learned twice.

**In scope:** a knowledge entry has a scope, this project or a group; group entries show up in session start and recall for every project in the group, marked as shared; the Memory tab shows and edits group entries; move an entry between project and group scope; the session handoff stays per project
**Out of scope:** memory shared between people on different machines beyond what git gives (R034), automatic promotion of project entries to the group
**Done when:** an agent saves a group convention while working in `api`, and the next session in `web` lists it in `vibedoc_read_memory`

## Scenarios
### S1: Shared fact reaches another repo
- WHEN an agent saves an entry with group scope in project A
- THEN the next session in project B of the same group lists it, marked shared
### S2: Project entries stay private
- WHEN an entry has project scope
- THEN it never appears in other projects of the group
### S3: Not in a group
- WHEN a project is in no group
- THEN memory works exactly as today

## Spec changes
### memory
#### ADDED Requirement: Group entries reach every project in the group
A knowledge entry SHALL have a scope, its project or a group; an entry with group scope SHALL appear in session start, recall and related memory for every project in that group, marked as shared, and an entry with project scope SHALL appear only in its project.
##### Scenario: Shared fact reaches another repo
- WHEN an agent saves an entry with group scope in project A
- THEN the next `vibedoc_read_memory` in project B of the same group lists it, marked shared
##### Scenario: Project scope stays put
- WHEN an entry has project scope
- THEN no other project of the group lists it
