# R101: Import projects
**Parent:** R002
**Status:** in-progress
**Order:** 420
**Tasks:** T536, T537

Users add projects from inside VibeDoc, not only by running the command in each repo, so setting up the hub for many repos takes one minute.

**In scope:** add by folder path (with a folder picker); scan a folder (e.g. `~/work`) and tick which repos to add, skipping ones already in the hub; clone from a git URL into a folder the user picks, then add it; a project with no docs or roadmap lands on the welcome (R082)
**Out of scope:** importing tasks from other trackers (Linear, GitHub Issues), monorepo packages as separate projects
**Done when:** a user scans `~/work`, ticks 5 repos, and all 5 appear on All projects with their task counts

## Scenarios
### S1: Scan a folder
- WHEN the user scans a folder with 8 repos, 2 already in the hub
- THEN 6 are offered, and only the ticked ones are added
### S2: Clone
- WHEN the user pastes a git URL and picks a folder
- THEN the repo is cloned there and opens in the hub, or the clone error is shown in words
