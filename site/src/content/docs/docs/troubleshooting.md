---
title: Troubleshooting
description: Fixes for the problems people hit first.
---

### The agent can't reach VibeDoc

- Check VibeDoc is running: open the URL it printed.
- The port changed since you connected. A project keeps its port between runs (saved in `.vibedoc/port`); it only moves when another program holds it, and then the terminal says so and prints the new MCP URL. Reconnect Claude Code with `claude mcp remove vibedoc`, then the `claude mcp add …` command VibeDoc printed. To choose the port yourself: `npx vibedoc --port 4000`.
- Running `vibedoc` again while it already runs for this project doesn't start a second copy: it prints the same URLs and opens the browser.
- Claude Code: `claude mcp list` shows whether `vibedoc` is connected. Restart the session after adding it.
- Claude Code answers "This MCP call names no project": the session started outside every VibeDoc project, or `PWD` wasn't set. Start `claude` inside the project folder, or connect that project on its own with the command in the reply.

### The board is empty

VibeDoc reads the folder it was started in. Start it in your project, or set `VIBEDOC_ROOT=/path/to/project`. Tasks are `plans/tasks/T*.md` files with a `**Status:**` line right under the `# T001: Title` heading.

### A task file doesn't show its status or phase

The `**Key:** Value` lines must sit directly under the H1, with no blank line between them. Anything after the first blank line is the body.

### `/vibedoc:*` commands are missing

Install the plugin (see [Skills](/vibedoc/docs/skills/)), then restart Claude Code or run `/reload-plugins`.

### Browser tests don't run

Open **Settings → Frontend app**. VibeDoc shows the app it detected, its start command and URL; fix them there if the guess is wrong. If Playwright is missing, the same page shows the install command. If pages need a login, click **Log in** once to save a session.

### VibeDoc keeps crashing

A background VibeDoc (`vibedoc start`) restarts itself after a crash. After 5 crashes within a minute it gives up, and `vibedoc status` says `○ VibeDoc is not running` with the last error: the exit code and the last lines of the log. The whole log is `~/.vibedoc/logs/server.log` (`$VIBEDOC_HOME/logs/server.log` when you set it). Look there for the first error after `supervisor: starting VibeDoc`. Fix it, then run `vibedoc start`. If you can't tell what it means, open an issue with those lines.

### VibeDoc doesn't start when I log in

Run `vibedoc login status`. `Start at login: off` means it was never turned on (or the installer was answered no): run `vibedoc login on`. If it says on, the login item runs `vibedoc start --no-open` with the path the item names; if that VibeDoc was moved or uninstalled, run `vibedoc login on` again from the one you use now, so it points there. Then log out and in, and check `vibedoc status` and `~/.vibedoc/logs/server.log`.

### The desktop app won't open (unsigned app)

The installers aren't signed yet. On macOS, right-click (Control-click) VibeDoc in Applications → **Open** → **Open**, or System Settings → Privacy & Security → **Open Anyway**. On Windows, SmartScreen's **More info** → **Run anyway**. You only do this once.

### The desktop app says "VibeDoc couldn't start"

The window shows the reason and the last lines of `~/.vibedoc/logs/desktop-server.log`. The usual one: another program holds VibeDoc's address (`http://localhost:3333 is in use by another program`). Stop that program, or put another port in `~/.vibedoc/port`, then click **Try again**. A VibeDoc you run from the terminal never causes this: the app uses it.

### The desktop app can't install an update

On macOS an app can install its own updates only once it is signed, so the update card says it couldn't install and offers **Download the new version**: download the `.dmg` from the release page and drag VibeDoc over the old one. On Windows and Linux, **Try again** on the card; if it keeps failing, download the installer from the [latest release](https://github.com/quanghoangf/vibedoc/releases/latest).

### `npx vibedoc` says the Node version is too old

VibeDoc needs Node.js 20.9 or newer. `node -v` shows yours. Homebrew installs bring their own Node.

### Something else

Open an issue on [GitHub](https://github.com/quanghoangf/vibedoc/issues) with the output of `vibedoc --version` and what you saw.
