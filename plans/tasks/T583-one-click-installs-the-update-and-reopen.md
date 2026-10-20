# T583: One click installs the update and reopens the app on the new version
**Status:** 👀 Review
**Phase:** R112 — Desktop installers & auto-update
**Size:** M
**Depends on:** T582
**Covers:** S2
**Owner:** ai:claude
**Due:** 2026-10-24
**Started:** 2026-10-21

## Goal
From the update banner, one click downloads the new version, shows progress, installs it and reopens VibeDoc on the new version, restarting the VibeDoc server the app runs.

## Context
- Epic: `plans/roadmap/R112-desktop-installers-auto-update.md`
- Builds on the banner from T-update-check.
- R111 rule: quitting the app stops only a VibeDoc the app itself started. A background VibeDoc from the terminal install (R109/R110) is never stopped by the app. It updates through its own channel (`vibedoc --update`, npm, Homebrew).
- Decision: on update, the app stops the VibeDoc it started, installs, relaunches, and the relaunched app starts the new bundled server. When the app is using a terminal-install VibeDoc, it leaves that one running.
- macOS gotcha: Squirrel.Mac only installs updates into a **signed** app. Until T-sign lands, the macOS install step fails. In that case show "Download the new version" linking to the release page instead of failing silently.

<!-- vibedoc:steps -->
- **Click Update** — the banner becomes a progress bar (download %)
- **Downloaded** — the button says "Restart to update"
- **Restart** — stop the app-started VibeDoc, `quitAndInstall()`
- **Reopen** — the new version starts its server and shows the board

## Scope
- [ ] IPC `vibedocDesktop.downloadUpdate()` → `autoUpdater.downloadUpdate()`. Forward `download-progress` and `update-downloaded`
- [ ] Banner states: available → downloading (percent) → ready ("Restart to update") → error (with a link to the release page)
- [ ] On restart: stop the server the app started (reuse R111's shutdown path), then `autoUpdater.quitAndInstall(false, true)`
- [ ] Unsaved work guard: if a chat is streaming, confirm first
- [ ] macOS unsigned: catch the Squirrel error and fall back to the release-page link

**Out of scope:** updating the terminal-install VibeDoc, and silent or background installs.

## Files
- `desktop/src/updater.ts`: download and install
- `desktop/src/preload.ts`
- `src/components/…/DesktopUpdateBanner.tsx`: progress, ready and error states

## Acceptance criteria
- [ ] Windows and Linux AppImage: from version N, one click → progress → restart → the app reopens and its About / `--version` shows N+1
- [ ] After the restart, the board loads from the new server version. The old app-started server process is gone (no orphan on the port)
- [ ] With a terminal-install VibeDoc in use, it is still running (same PID) after the app updates
- [ ] macOS unsigned: a clear "Download the new version" fallback, no crash
- [ ] Unit test for the banner state machine

## Verify
```bash
pnpm test
pnpm --dir desktop run dist
# install version N, publish/serve N+1 feed, click Update → reopens on N+1
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S2 — WHEN a newer release exists → THEN the app says so with its release notes, and one click installs it and reopens the app on the new version
- [ ] Windows: install version N, publish N+1, open the app → Update → the card counts up to 100% → "Restart to update" → the app reopens and VibeDoc → About says N+1
- [ ] Linux AppImage: the same
- [ ] After the restart, `lsof -i :<port>` shows one server, started by the new version; the old one is gone
- [ ] With `vibedoc start` running before opening the app, update the app → `vibedoc status` shows the same pid and start time as before
- [ ] macOS (unsigned build): Update → "VibeDoc X.Y.Z couldn’t be installed from here" with Try again and "Download the new version", which opens the release in the browser; nothing crashes
- [ ] With an agent working in a chat, Restart to update → a confirm first; Cancel keeps everything as it was
### Regression risk
- [ ] Later and What’s new from T582 still work, and nothing shows in a browser tab
- [ ] _Checked here (macOS): `node src/lib/desktop-update.check.mts` (the card’s state machine) passes; `e2e/desktop-app.mjs` passes with a local feed serving 99.0.0 and a real (empty) zip: Update downloads it and, unsigned, lands on the release-page fallback; the packaged arm64 app (`dist --dir`, PATH without Node) does the same and its app.asar carries electron-updater. Not run: an actual install + relaunch (needs Windows / Linux, or a signed Mac build, T585), and the terminal-install same-pid check (beforeInstall returns early for a VibeDoc the app didn’t start; not exercised end to end). The banner also skips itself when the page’s VibeDoc is another version without this preload API (a terminal install of another version)._
