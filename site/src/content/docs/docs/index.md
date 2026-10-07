---
title: Getting started
description: From install to an AI agent moving its first task, in about five minutes.
---

From install to an AI agent moving its first task, in about five minutes. You need Node.js 20.9 or newer (Homebrew brings its own).

Rather not read? [Paste one prompt into your agent](/vibedoc/docs/ai-install/) and it does these steps for you.

## 1. Install and start

In the project you want to work on:

```bash
cd your-project
npx vibedoc
```

VibeDoc prints the app URL, the MCP URL and the command to connect Claude Code in the terminal, then opens your browser on the screen that fits the project: a new project gets a welcome with one first move (plan the roadmap from your docs, or plan the first epics with the agent), and a project that already has tasks or a roadmap opens the board, or the page you used last. The template wizard is optional: **Write project docs** on the welcome opens it. A project keeps the same port on every run (saved in `.vibedoc/port`), so the agent's MCP URL stays the same between restarts. Choose another one with `npx vibedoc --port 4000`.

To keep a `vibedoc` command instead of `npx`, install it with any channel. Every channel serves the same version; `vibedoc --version` shows yours.

| Channel | Install | Update | Uninstall |
|---------|---------|--------|-----------|
| npm | `npm install -g vibedoc` | `npm install -g vibedoc@latest` | `npm uninstall -g vibedoc` |
| pnpm | `pnpm add -g vibedoc` | `pnpm add -g vibedoc@latest` | `pnpm remove -g vibedoc` |
| bun | `bun add -g vibedoc` | `bun add -g vibedoc@latest` | `bun remove -g vibedoc` |
| Homebrew | `brew install quanghoangf/vibedoc/vibedoc` | `brew upgrade vibedoc` | `brew uninstall vibedoc` |

**No Node on the machine?** The one-line installer brings its own Node (into `~/.vibedoc`, checksum-verified) and asks before adding `~/.vibedoc/bin` to your PATH:

```bash
# macOS, Linux
curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh
# update / uninstall
curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh -s -- --update
curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh -s -- --uninstall
```

```powershell
# Windows (PowerShell)
irm https://quanghoangf.github.io/vibedoc/install.ps1 | iex
& ([scriptblock]::Create((irm https://quanghoangf.github.io/vibedoc/install.ps1))) -Uninstall
```

Uninstalling removes only VibeDoc's Node, package and launcher, never your projects or saved test runs.

VibeDoc reads the folder you start it in. For another folder: `VIBEDOC_ROOT=/path/to/project npx vibedoc`.

## 2. Connect your agent

The MCP server is `http://localhost:<port>/api/mcp` (HTTP JSON-RPC). Use the port from the terminal.

Easiest: open **Settings → Connect agent** (`/settings?tab=connect`) in VibeDoc. For Claude Code it adds the MCP server and installs the `/vibedoc:*` skills after you confirm each command; for Cursor or another agent it shows the config to paste. Each step turns ✓ only from evidence: the agent's first VibeDoc tool call, or the plugin found in `claude plugin list`. The commands below do the same by hand.

**Claude Code**

```bash
claude mcp add --transport http vibedoc http://localhost:3333/api/mcp
```

**Cursor**: `.cursor/mcp.json` in the project root. **Windsurf**: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "vibedoc": { "url": "http://localhost:3333/api/mcp" }
  }
}
```

Any other MCP client: add the same URL as an HTTP server. Check the connection by asking the agent to "list the VibeDoc tasks": it calls [`vibedoc_list_tasks`](/vibedoc/docs/tools/vibedoc_list_tasks/).

In Claude Code, also install the [skills](/vibedoc/docs/skills/):

```text
/plugin marketplace add quanghoangf/vibedoc
/plugin install vibedoc@vibedoc
```

## 3. Get a first task on the board

Nothing is required up front. Create `plans/tasks/T001-hello.md`:

```markdown
# T001: Say hello
**Status:** 📋 Todo

## Goal
Add a hello line to README.md.
```

Or plan properly: run `/vibedoc:roadmap` for epics, then `/vibedoc:breakdown R001` for tasks.

## 4. Run a first session

Ask the agent to work the task, or run `/vibedoc:work R001` for a whole epic. The board updates live while it works:

1. [`vibedoc_read_memory`](/vibedoc/docs/tools/vibedoc_read_memory/) reads the handoff from the last session.
2. [`vibedoc_get_status`](/vibedoc/docs/tools/vibedoc_get_status/) shows what is active and blocked.
3. [`vibedoc_next_task`](/vibedoc/docs/tools/vibedoc_next_task/) claims the next ready task, and the card moves to In progress.
4. The agent does the work and writes a test checklist; [`vibedoc_update_task`](/vibedoc/docs/tools/vibedoc_update_task/) moves it to done, or to review when something is left for you.
5. [`vibedoc_update_memory`](/vibedoc/docs/tools/vibedoc_update_memory/) writes the handoff for the next session.

Then review the task on **Test review**: its checklist, the screenshots and video of the run. See [Evidence](/vibedoc/docs/concepts/evidence/).

## Language

VibeDoc's interface comes in English and Vietnamese (Tiếng Việt). Pick one in **Settings → Appearance → Language**. The switch is instant, with no reload. The choice is saved for this browser (a `vibedoc-lang` cookie), not in the project, so teammates each keep their own. Your docs, tasks and the agent's replies stay in the language they were written in. A few fonts in Settings have no Vietnamese letters and say so.
