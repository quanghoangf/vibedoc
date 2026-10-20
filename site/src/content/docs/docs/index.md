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

VibeDoc prints the app URL, the MCP URL and the command to connect Claude Code in the terminal, then opens your browser on the screen that fits the project: a new project gets a welcome with one first move (plan the roadmap from your docs, or plan the first epics with the agent), and a project that already has tasks or a roadmap opens the board, or the page you used last. The template wizard is optional: **Write project docs** on the welcome opens it. Choose another port with `npx vibedoc --port 4000`.

**One VibeDoc for all your projects.** Run `npx vibedoc` anywhere inside a repo, even in a package folder of a monorepo: VibeDoc walks up to the folder with `.git`, adds that repo to **All projects** the first time, and opens it. Every project is served from the same address, on the same port on every run (saved in `~/.vibedoc/port`), and each one has its own MCP URL (`…/api/mcp?root=<project folder>`), so the agent's URL stays the same between restarts. Run it outside any repo and All projects opens.

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

The one-line installer (macOS, Linux) also asks whether to keep VibeDoc running in the background and start it when you log in (default no). Yes turns on [start at login](#start-at-login) and starts VibeDoc right away; `VIBEDOC_BACKGROUND=1` or `=0` answers for scripts, and with nobody at the keyboard the answer is no. `--update` keeps that choice (it stops VibeDoc, replaces it and starts it again), and `--uninstall` stops VibeDoc and removes the login item first.

Uninstalling removes only VibeDoc's Node, package and launcher, never your projects or saved test runs.

VibeDoc opens the repo you start it in. For another folder: `VIBEDOC_ROOT=/path/to/project npx vibedoc`.

### Run in the background

`vibedoc` runs in the foreground: closing the terminal (or Ctrl+C) stops it. To keep VibeDoc up without a terminal open, start it in the background:

```bash
vibedoc start            # same flags as vibedoc: --port, --no-open
```

It prints `✓ VibeDoc is running in the background at http://localhost:<port>` with the MCP URL, opens the browser and gives the terminal back. The server's output goes to `~/.vibedoc/logs/server.log`. Run `vibedoc start` again, in the same repo or another one, and it reuses the running VibeDoc: it adds that repo and prints the same address, never a second server. The same goes for plain `vibedoc` while a background one runs. If the app can't start, `start` prints why and the end of the log, and exits with a non-zero code.

`vibedoc status` says whether VibeDoc runs and where: `● VibeDoc is running at http://localhost:3333`, since when, and the log file. A plain `vibedoc` shows as running in the foreground. Otherwise it prints `○ VibeDoc is not running`, with the last error when the server stopped on one. It exits 0 when VibeDoc runs and 3 when it doesn't, and `--json` prints the state for scripts.

`vibedoc stop` stops the background VibeDoc and everything it started: agent workers, test runs and the dev servers it launched for them. It doesn't ask first. It names the agent runs it stopped (`Stopped 2 agent runs (R108, R109). They show as Interrupted with Resume next time.`): after the next `vibedoc start`, each one waits on its chat with **Resume**, which continues the task where it stopped. It ends with `✓ VibeDoc stopped`, and `status` then says not running. With nothing running it says so and exits 0. A VibeDoc running in the foreground isn't stopped: press Ctrl+C in its terminal.

If the background server crashes, VibeDoc restarts it on the same address after 1 s, then 2 s, then 4 s. Your agents keep their MCP URL, and agent runs keep going through the restart. After 5 crashes within a minute it stops retrying and stays down: `vibedoc status` shows the exit code and the last lines of the log, and `vibedoc start` starts it again. The full output is in `~/.vibedoc/logs/server.log` (the previous one in `server.log.1`).

### Start at login

To have VibeDoc running whenever you log in, with no command to type, turn on start at login:

```bash
vibedoc login on       # start in the background each time you log in
vibedoc login status   # Start at login: on (LaunchAgent, ~/Library/LaunchAgents/io.github.quanghoangf.vibedoc.plist)
vibedoc login off      # stop doing that
```

At login it runs `vibedoc start --no-open` with the full path of the VibeDoc you installed, so no browser tab opens and PATH doesn't matter. Each OS gets one login item, and running `on` again rewrites it, never a second one:

| OS | Login item |
|---|---|
| macOS | LaunchAgent `~/Library/LaunchAgents/io.github.quanghoangf.vibedoc.plist` |
| Linux | systemd user unit `~/.config/systemd/user/vibedoc.service` (enabled with `systemctl --user enable`); without systemd, `~/.config/autostart/vibedoc.desktop` |
| Windows | the `VibeDoc` value under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (no admin rights) |

`on` takes effect at your next login; run `vibedoc start` to start it now. `off` removes only the login item: a VibeDoc that is running keeps running until `vibedoc stop` or you log out, and your projects, saved runs and settings are untouched.

## 2. Connect your agent

The MCP server is `http://localhost:<port>/api/mcp?root=<project folder>` (HTTP JSON-RPC). Use the MCP URL the terminal prints.

Easiest: open **Settings → Connect agent** (`/settings?tab=connect`) in VibeDoc. For Claude Code it adds the MCP server and installs the `/vibedoc:*` skills after you confirm each command; for Cursor or another agent it shows the config to paste. Each step turns ✓ only from evidence: the agent's first VibeDoc tool call, or the plugin found in `claude plugin list`. The commands below do the same by hand.

**Claude Code: one connection for every project.** **Connect all projects** in the same panel runs this once, in any folder:

```bash
claude mcp add --scope user --transport http vibedoc http://localhost:3333/api/mcp --header 'X-VibeDoc-Root: ${PWD}'
```

Claude Code fills in `${PWD}` with the folder each session starts in, and VibeDoc answers about the project that folder is in (a sub-folder works). Projects you add to VibeDoc later need nothing more. Keep the single quotes, so your shell doesn't fill in `${PWD}` when you run the command. A session started outside every VibeDoc project gets the project list back, never another project's answers. If you start Claude Code from an IDE or a launcher, `PWD` can be the launcher's folder: connect that project on its own instead (below). A per-project connection always wins over the one for every project.

**Claude Code: this project only**

```bash
claude mcp add --transport http vibedoc 'http://localhost:3333/api/mcp?root=%2Fpath%2Fto%2Fproject'
```

**Cursor**: `.cursor/mcp.json` in the project root. **Windsurf**: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "vibedoc": { "url": "http://localhost:3333/api/mcp?root=%2Fpath%2Fto%2Fproject" }
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

## First week checklist

The sidebar shows a **First week** checklist until you finish it or dismiss it. It ticks itself from what is in the project, so you never tick anything by hand:

| Step | Ticks when |
|---|---|
| Agent connected | any agent call shows up in the activity log |
| Roadmap created | `plans/roadmap/` has an item |
| First epic broken down | an epic has linked tasks |
| First task done by the agent | an agent finished a task |
| First test run with evidence | a task has a recorded test run |
| First memory entry | `memory/entries/` has an entry |

The first open step shows where to go, or the exact command to copy (`claude mcp add …`, `/vibedoc:roadmap`, `/vibedoc:breakdown R002`, `/vibedoc:work R002`). Dismiss it with ✕: it stays hidden for this project (`.vibedoc/first-week.json`; add that file to your `.gitignore` if teammates should still see their own checklist).

## Language

VibeDoc's interface comes in English and Vietnamese (Tiếng Việt). Pick one in **Settings → Appearance → Language**. The switch is instant, with no reload. The choice is saved for this browser (a `vibedoc-lang` cookie), not in the project, so teammates each keep their own. Your docs, tasks and the agent's replies stay in the language they were written in. A few fonts in Settings have no Vietnamese letters and say so.
