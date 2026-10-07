# R080: Stable address & startup
**Parent:** R002
**Status:** in-progress
**Order:** 320
**Tasks:** T231, T232, T233, T234

Every `vibedoc` run in a project comes up at the same address and says so. An agent connected once then stays connected, and the README's "prints its MCP URL" becomes true.

**In scope:** the same address for a project on every run (a new one only when it is taken, and the user is told); the terminal prints the app URL, the MCP URL and the one connect command; the browser opens when the app is actually ready, not after a fixed wait; a clear message when the port is taken or the start fails
**Out of scope:** running as a background service, several projects on one address
**Done when:** a user stops and restarts `vibedoc` in the same project, and their already-connected Claude Code keeps working with no reconfiguration

## Scenarios
### S1: Same address on restart
- WHEN the user runs `vibedoc` in a project, stops it and runs it again
- THEN both runs serve the same URL and the MCP URL printed in the terminal is unchanged
### S2: Address taken
- WHEN the project's usual port is in use by another program
- THEN VibeDoc starts on another port and the terminal says the MCP URL changed and how to reconnect
### S3: Ready before the browser opens
- WHEN the browser opens
- THEN the page loads on the first try, with no connection error

## Spec changes
### cli-startup
#### ADDED Requirement: Stable project address
The system SHALL serve a project at the same address on every run unless that port is taken, and SHALL print the app URL, the MCP URL and the agent connect command at start.
##### Scenario: Restart
- WHEN `vibedoc` is restarted in the same project
- THEN the printed MCP URL is the same as on the previous run
#### ADDED Requirement: Open when ready
The system SHALL open the browser only after the app answers requests, and SHALL print a clear reason and exit non-zero when it cannot start.
##### Scenario: Start failure
- WHEN the app cannot start
- THEN the terminal shows why and no browser tab opens
