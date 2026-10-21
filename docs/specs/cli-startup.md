# Cli startup

## Requirements

### Requirement: Stable project address
The system SHALL serve a project at the same address on every run unless that port is taken, and SHALL print the app URL, the MCP URL and the agent connect command at start.
#### Scenario: Restart
- WHEN `vibedoc` is restarted in the same project
- THEN the printed MCP URL is the same as on the previous run

### Requirement: Open when ready
The system SHALL open the browser only after the app answers requests, and SHALL print a clear reason and exit non-zero when it cannot start.
#### Scenario: Start failure
- WHEN the app cannot start
- THEN the terminal shows why and no browser tab opens
