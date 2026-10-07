# R081: Connect your agent
**Parent:** R002
**Status:** planned
**Order:** 330
**Tasks:** T250, T251, T252, T253, T254

A Claude Code user connects VibeDoc from inside the app in under a minute and sees proof that it worked. Today connecting takes three manual steps from the README and nothing confirms they worked.

**In scope:** a "Connect your agent" panel (first screen + Settings) with steps for the MCP server and the `/vibedoc:*` skills; one click runs each step for the user after they confirm, with a copy-the-command fallback; a live ✓ per step (MCP: the agent's first call arrives; skills: the plugin is installed); Cursor and other agents get copy-paste config with the same live MCP ✓; a step that fails shows the real error and the fix
**Out of scope:** installing Claude Code itself, IDE-specific installers, managing several agents per project
**Done when:** on a fresh project, a Claude Code user goes from `npx vibedoc` to a ✓ on both steps without opening the README

## Scenarios
### S1: One-click MCP connect
- WHEN the user clicks Connect for Claude Code and confirms
- THEN VibeDoc is added to Claude Code's MCP servers and the step says what was changed
### S2: Live proof
- WHEN the connected agent makes its first VibeDoc call
- THEN the MCP step turns ✓ without a reload
### S3: Skills installed
- WHEN the vibedoc plugin is installed in Claude Code
- THEN the skills step shows ✓ and lists `/vibedoc:roadmap` as the next thing to try
### S4: Other agents
- WHEN the user picks Cursor or "Other"
- THEN they get the config to paste, and the MCP step still turns ✓ on the first call

## Spec changes
### agent-connection
#### ADDED Requirement: Guided connection
The system SHALL show the steps to connect an agent (MCP server, and for Claude Code the skills plugin) with the current MCP URL, and SHALL run a step only after the user confirms it.
##### Scenario: Confirm first
- WHEN the user clicks Connect
- THEN nothing changes outside VibeDoc until they confirm, and the result names what changed
#### ADDED Requirement: Connection status
The system SHALL show each connection step as done only from evidence (an MCP call received, the plugin found) and SHALL update it live.
##### Scenario: First call
- WHEN an agent calls any VibeDoc MCP tool
- THEN the MCP step shows connected, with the agent's name when known
