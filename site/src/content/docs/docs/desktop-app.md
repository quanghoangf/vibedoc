---
title: Desktop app
description: VibeDoc in its own window with a Dock or taskbar icon. The same app as the browser, and both stay in sync.
---

VibeDoc also runs as a desktop app: its own window, its own Dock / taskbar icon, the same screens as the browser. Use either one, or both at once on the same project: a task you move in the app moves in the browser tab within a second, and the other way round.

## Two ways it runs

<!-- vibedoc:compare -->
- **VibeDoc already runs** — `vibedoc` in a terminal or `vibedoc start` in the background: the app opens it, the menu says `Using VibeDoc at http://localhost:3333`, and closing or quitting the app leaves it running
- **Nothing runs** — the app starts VibeDoc itself (a "Starting VibeDoc…" screen, then the board), the menu says `started by this app`, and quitting the app stops it

The app finds VibeDoc the way the CLI does, at the address saved in `~/.vibedoc/port`, so your agents keep the MCP URL they connected to. Opening the app again focuses its window instead of starting a second copy. If VibeDoc can't start, the window says why, shows the end of the log (`~/.vibedoc/logs/desktop-server.log`) and offers **Try again**.

For a VibeDoc that is always there, even with the app closed, turn on background mode: `vibedoc start`, or `vibedoc login on` to start it at every login (see [Run in the background](/vibedoc/docs/#run-in-the-background)).

## In the window

- **Links to other sites** open in your default browser. Links inside VibeDoc stay in the window.
- **A chat waiting on you** shows a desktop notification when the window isn't in front. Click it to jump to that chat.
- **The Dock / taskbar badge** shows your inbox count.
- Copy, paste, reload and zoom work from the usual menus and shortcuts. The app's own text follows your OS language (English or Vietnamese).

## Run it from source

Installers for macOS, Windows and Linux are on the way. Until then, from a VibeDoc checkout:

```bash
pnpm install && pnpm build          # the app VibeDoc serves
pnpm --dir desktop install          # Electron, in its own package
pnpm --dir desktop start
```
