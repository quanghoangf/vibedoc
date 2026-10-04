# Getting started

From install to an AI agent moving its first task, in about five minutes.

## 1. Install and start

You need Node.js 20.9 or newer. In the project you want to work on:

```bash
cd your-project
npx vibedoc
```

VibeDoc picks a free port, prints the URL in the terminal and opens the setup wizard (`/setup`) in your browser. The wizard can generate starter docs such as `CLAUDE.md`. It is optional: to skip it, click **Board** in the sidebar. Pin the port with `npx vibedoc --port 3333`.

## 2. Point it at a project

VibeDoc reads the folder you start it in. To use another folder:

```bash
VIBEDOC_ROOT=/path/to/project npx vibedoc
```

Nothing is required up front. VibeDoc shows what it finds:

| Path | What it is |
|------|------------|
| `plans/tasks/T001-*.md` | Tasks, one file each, with a `**Status:**` line |
| `docs/**/*.md` | Docs |
| `memory/MEMORY.md` | The session handoff the agent reads first |
| `CLAUDE.md` | Agent instructions |

To get a first task on the board, create `plans/tasks/T001-hello.md`:

```markdown
# T001: Say hello
**Status:** 📋 Ready

## Goal
Add a hello line to README.md.
```

## 3. Connect your agent

The MCP server is at `http://localhost:<port>/api/mcp` (HTTP JSON-RPC). Use the port from the terminal.

### Claude Code

```bash
claude mcp add --transport http vibedoc http://localhost:<port>/api/mcp
```

Or add it to `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "vibedoc": { "type": "http", "url": "http://localhost:<port>/api/mcp" }
  }
}
```

### Cursor

Add the same server to `.cursor/mcp.json` in the project root:

```json
{
  "mcpServers": {
    "vibedoc": { "url": "http://localhost:<port>/api/mcp" }
  }
}
```

Check the connection: ask the agent to "list the VibeDoc tasks". It calls `vibedoc_list_tasks` and you see the board come back.

## 4. Run a first session

Ask the agent to follow this loop. The board updates live while it works.

1. `vibedoc_read_memory`: read the handoff from the last session.
2. `vibedoc_get_status`: see what is active and what is blocked.
3. `vibedoc_get_task T001`, then `vibedoc_update_task T001 in-progress`. The card moves on the board. In an epic, `vibedoc_next_task { epic: "R001" }` claims the next ready task in one call.
4. Do the work.
5. `vibedoc_update_task T001 done`.
6. `vibedoc_update_memory`: write the handoff for the next session.

To make this the default, paste the session protocol from the [README](https://github.com/quanghoangf/vibedoc#recommended-claudemd-snippet) into your project's `CLAUDE.md`.

## Next

- [MCP tools reference](https://github.com/quanghoangf/vibedoc/blob/main/docs/architecture/mcp-tools.md): every tool and its parameters.
- In the app: **Roadmap** for epics, **Memory** for knowledge entries, **Graph** for links between docs.
