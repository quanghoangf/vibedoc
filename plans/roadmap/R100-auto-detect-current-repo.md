# R100: Auto-detect current repo
**Parent:** R002
**Status:** in-progress
**Order:** 410
**Tasks:** T533, T534, T535

Running `npx vibedoc` inside a repo adds that repo to the hub and opens it, so the first command a user already knows keeps working with many projects.

**In scope:** detect the repo from the current folder (walk up to the repo root, monorepo root wins over a package folder); add it to the hub if new; when VibeDoc is already running, open the project there instead of starting a second copy; running outside any repo opens All projects; users of today's one-VibeDoc-per-project setup keep their data and are told once what changed
**Out of scope:** scanning a folder for many repos (R101)
**Done when:** `npx vibedoc` in repo A, then in repo B, leaves one VibeDoc running with both projects in the hub, and the browser opened on B

<!-- vibedoc:steps -->
- **Run `npx vibedoc`** — in any folder
- **Find the repo** — walk up to the repo root
- **Add to the hub** — only if it is new
- **Open it** — in the VibeDoc that is already running, or a new one

## Scenarios
### S1: New repo
- WHEN the user runs `npx vibedoc` in a repo the hub doesn't know
- THEN the repo is added to All projects and its board opens
### S2: Already running
- WHEN VibeDoc is already running and the user runs `npx vibedoc` in another repo
- THEN no second VibeDoc starts and the browser opens that repo in the running one
### S3: Not in a repo
- WHEN the user runs `npx vibedoc` outside any repo
- THEN All projects opens

## Spec changes
### cli-startup
#### MODIFIED Requirement: Stable project address
The system SHALL serve every project from one VibeDoc at the same address on every run unless that port is taken, each project at its own path under that address, and SHALL print the app URL, the project's MCP URL and the agent connect command at start.
##### Scenario: Restart
- WHEN `vibedoc` is restarted in the same project
- THEN the printed MCP URL is the same as on the previous run
##### Scenario: Second project
- WHEN `vibedoc` runs in a second repo while the first is open
- THEN both are served at the same address and the first repo's MCP URL does not change
#### ADDED Requirement: Open the current repo
The system SHALL detect the repo the command runs in, add it to the project list when it is new, and open it in the VibeDoc that is already running instead of starting another one.
##### Scenario: Already running
- WHEN `vibedoc` runs in another repo while VibeDoc is running
- THEN no second server starts and the browser opens that repo
