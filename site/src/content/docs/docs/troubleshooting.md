---
title: Troubleshooting
description: Fixes for the problems people hit first.
---

### The agent can't reach VibeDoc

- Check VibeDoc is running: open the URL it printed.
- The port changed since you connected. Start with a fixed port (`npx vibedoc --port 3333`) and use that port in the MCP config.
- Claude Code: `claude mcp list` shows whether `vibedoc` is connected. Restart the session after adding it.

### The board is empty

VibeDoc reads the folder it was started in. Start it in your project, or set `VIBEDOC_ROOT=/path/to/project`. Tasks are `plans/tasks/T*.md` files with a `**Status:**` line right under the `# T001: Title` heading.

### A task file doesn't show its status or phase

The `**Key:** Value` lines must sit directly under the H1, with no blank line between them. Anything after the first blank line is the body.

### `/vibedoc:*` commands are missing

Install the plugin (see [Skills](/vibedoc/docs/skills/)), then restart Claude Code or run `/reload-plugins`.

### Browser tests don't run

Open **Settings → Frontend app**. VibeDoc shows the app it detected, its start command and URL; fix them there if the guess is wrong. If Playwright is missing, the same page shows the install command. If pages need a login, click **Log in** once to save a session.

### `npx vibedoc` says the Node version is too old

VibeDoc needs Node.js 20.9 or newer. `node -v` shows yours. Homebrew installs bring their own Node.

### Something else

Open an issue on [GitHub](https://github.com/quanghoangf/vibedoc/issues) with the output of `vibedoc --version` and what you saw.
