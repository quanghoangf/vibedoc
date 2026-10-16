# R104: One agent connection
**Parent:** R002
**Status:** planned
**Order:** 450
**Tasks:** T543, T544, T545

The user connects their coding agent to VibeDoc once, and the agent works on whichever project it was opened in, so adding a project never means another `claude mcp add`.

**In scope:** one MCP address for the hub; the agent's project follows the folder it runs in, with a clear answer when that folder isn't in the hub (offer to add it); the agent can list projects and act on another one only when asked; Settings → Connect agent shows the one connection for all projects; existing per-project connections keep working
**Out of scope:** agents other than Claude Code / Cursor / generic MCP clients already supported (R081)
**Done when:** after one Connect, a Claude Code session in repo A and one in repo B each read their own project's memory and tasks

## Scenarios
### S1: Right project
- WHEN an agent connected once calls a tool from inside repo B
- THEN the reply is about repo B, not the first project connected
### S2: Unknown folder
- WHEN the agent runs in a folder that isn't in the hub
- THEN the reply says so and how to add it, and changes nothing
