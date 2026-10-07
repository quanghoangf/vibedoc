# R082: Smart first screen
**Parent:** R002
**Status:** in-progress
**Order:** 340
**Tasks:** T270, T271, T272, T273

The first screen fits the project in front of it and offers the right first move, so a new user doesn't land in a 7-step template wizard they may not need.

**In scope:** a welcome screen on first open that reads the project (agent connected? docs? tasks? roadmap?) and offers 1–2 starts: existing docs → generate the roadmap; empty project → plan the first epics with the agent; already set up → go straight to the board; it hosts the Connect panel (R081); after setup, later runs open where the user left off; the template wizard stays as an optional "Write project docs" action
**Out of scope:** changing what the wizard generates, a guided product tour
**Done when:** opening VibeDoc in an empty repo, in a repo with docs and in a VibeDoc-managed repo each lands on a different, correct first screen, and none of them opens the wizard

## Scenarios
### S1: Repo with docs, no roadmap
- WHEN VibeDoc opens a project that has docs but no roadmap for the first time
- THEN the welcome offers "Generate roadmap from your docs" first
### S2: Empty repo
- WHEN VibeDoc opens a project with no docs or tasks
- THEN the welcome offers to plan the first epics with the agent
### S3: Returning user
- WHEN VibeDoc opens a project that already has tasks or a roadmap
- THEN it opens the board (or the last page used), not the welcome
### S4: Wizard on request
- WHEN the user picks "Write project docs"
- THEN the template wizard opens

## Spec changes
### first-run
#### ADDED Requirement: Project-aware welcome
The system SHALL open a welcome on a project's first run that offers the starts that fit its contents, and SHALL skip it on projects that already have tasks or a roadmap.
##### Scenario: Set-up project
- WHEN the project already has tasks
- THEN the welcome is not shown
#### ADDED Requirement: Optional template wizard
The system SHALL open the project-docs template wizard only when the user asks for it.
##### Scenario: Plain start
- WHEN the user runs `vibedoc` with no flags
- THEN the template wizard does not open
