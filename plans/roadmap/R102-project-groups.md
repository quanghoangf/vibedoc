# R102: Project groups
**Parent:** R002
**Status:** planned
**Order:** 430
**Tasks:** T538, T539, T540

Repos that make one product (web, api, mobile) form a group the user plans and tracks as one, while each repo keeps its own files.

**In scope:** create, rename and delete a group; add and remove projects (a project can be in more than one group); the group's board and roadmap show every member's tasks and epics, tagged and filterable by repo; group membership is saved so it survives restarts and can be shared with the team through git
**Out of scope:** physically merging repos, epics whose tasks live in several repos, shared memory (R103)
**Done when:** a user groups `web` and `api` and sees both repos' tasks on one board, filtered to one repo in a click

## Scenarios
### S1: Group board
- WHEN a group has two projects with 5 and 3 open tasks
- THEN the group board shows all 8, each tagged with its repo
### S2: Delete a group
- WHEN the user deletes a group
- THEN its projects stay in the hub with their tasks unchanged
