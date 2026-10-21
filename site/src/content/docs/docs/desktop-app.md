---
title: Desktop app
description: VibeDoc in its own window with a Dock or taskbar icon. The same app as the browser, it updates itself, and both stay in sync.
---

> [!NOTE]
> The desktop app is a beta and isn't signed: the terminal install ([Install and start](/vibedoc/docs/)) with `vibedoc start` is the main way to run VibeDoc.

VibeDoc also runs as a desktop app: its own window, its own Dock / taskbar icon, the same screens as the browser. Use either one, or both at once on the same project: a task you move in the app moves in the browser tab within a second, and the other way round.

## Install

Download the installer for your computer. The links always point to the latest release:

| Computer | Download |
|---|---|
| Mac with Apple silicon (M1 and later) | [VibeDoc-mac-arm64.dmg](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-mac-arm64.dmg) |
| Mac with an Intel chip | [VibeDoc-mac-x64.dmg](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-mac-x64.dmg) |
| Windows 10 or 11 | [VibeDoc-Setup.exe](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-Setup.exe) |
| Linux (x86-64) | [VibeDoc-x86_64.AppImage](https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-x86_64.AppImage) |

- **macOS:** open the `.dmg` and drag VibeDoc to Applications.
- **Windows:** run `VibeDoc-Setup.exe`. It installs for your user only, no admin rights.
- **Linux:** `chmod +x VibeDoc-x86_64.AppImage`, then run it.

You don't need Node or anything else: the app carries its own VibeDoc.

### The first time you open it

The builds aren't signed yet, so your OS asks once:

- **macOS** says it can't check the developer. Right-click (or Control-click) VibeDoc in Applications → **Open** → **Open**. On recent macOS: System Settings → Privacy & Security → **Open Anyway**.
- **Windows** SmartScreen says it protected your PC. Click **More info** → **Run anyway**.

## Two ways it runs

<!-- vibedoc:compare -->
- **VibeDoc already runs** — `vibedoc` in a terminal or `vibedoc start` in the background: the app opens it, the menu says `Using the VibeDoc running from your terminal`, and closing or quitting the app leaves it running
- **Nothing runs** — the app starts VibeDoc itself (a "Starting VibeDoc…" screen, then the board), the menu says `started by this app`, and quitting the app stops it

The app finds VibeDoc the way the CLI does, at the address saved in `~/.vibedoc/port`, so your agents keep the MCP URL they connected to. Opening the app again focuses its window instead of starting a second copy. If VibeDoc can't start (another program holds the address, for one), the window says why, shows the end of the log (`~/.vibedoc/logs/desktop-server.log`) and offers **Try again**.

## Next to the terminal install

The app and the terminal install (`npm`, Homebrew, the one-line installer) can live on one machine. Whichever starts first serves the address and the other uses it, so there is only ever one VibeDoc: `vibedoc` in a terminal while the app's VibeDoc runs says "already running" and adds your repo to it. If your terminal VibeDoc is older than the app, the app says so once; update it the way you installed it.

For a VibeDoc that is always there, even with the app closed, use background mode from the terminal: `vibedoc start`, or `vibedoc login on` to start it at every login (see [Run in the background](/vibedoc/docs/#run-in-the-background)).

## Updates

The app checks for a new version when it starts and every few hours, and never downloads on its own. When there is one, a small card at the bottom of the window says **VibeDoc X.Y.Z is available**:

1. **What's new** shows the release notes.
2. **Update** downloads it (with the progress on the card), then **Restart to update** installs it and reopens the app on the new version. If an agent is still working in a chat, the app asks first.
3. **Later** hides that version; the next one shows the card again.

On macOS the app can only install updates once the builds are signed. Until then the card offers **Download the new version**, which opens the release page: download the `.dmg` and drag it over the old app.

## In the window

- **Links to other sites** open in your default browser. Links inside VibeDoc stay in the window.
- **A chat waiting on you** shows a desktop notification when the window isn't in front. Click it to jump to that chat.
- **The Dock / taskbar badge** shows your inbox count.
- Copy, paste, reload and zoom work from the usual menus and shortcuts. The app's own text follows your OS language (English or Vietnamese).

## Run it from source

From a VibeDoc checkout:

```bash
pnpm install && pnpm build          # the app VibeDoc serves
pnpm --dir desktop install          # Electron, in its own package
pnpm --dir desktop start
```
