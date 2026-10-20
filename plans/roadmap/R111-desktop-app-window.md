# R111: Desktop app window
**Parent:** R002
**Status:** in-progress
**Order:** 520
**Tasks:** T577, T578, T579, T580

VibeDoc opens as a desktop app with its own window and Dock / taskbar icon, with the same screens as the web version, for people who don't want it lost among their browser tabs.

**In scope:** a VibeDoc app for macOS, Windows and Linux; the window shows the same UI as the browser (one codebase, both keep working); the app uses the background VibeDoc when one runs (R109), else starts one, and says so; closing the window never stops a background VibeDoc; quitting the app stops only a VibeDoc the app itself started; links to other sites open in the browser; desktop notifications for chats waiting on the user
**Out of scope:** installers and updates (R112), a menu bar / tray icon, offline-only features the web version doesn't have
**Done when:** a user opens the VibeDoc app, works on the board and in a chat, has the same project open in a browser tab at the same time, and both stay in sync

<!-- vibedoc:compare -->
- **Background VibeDoc running** — the app opens on it; closing the app leaves it running
- **Nothing running** — the app starts VibeDoc; quitting the app stops it

## Scenarios
### S1: Same app, two windows
- WHEN the user has a project open in the desktop app and in a browser tab
- THEN a change in one shows in the other within a second
### S2: Uses the background VibeDoc
- WHEN VibeDoc already runs in the background and the user opens the app
- THEN the app shows it, no second VibeDoc starts, and closing the app leaves it running
### S3: Starts its own
- WHEN nothing is running and the user opens the app
- THEN the app starts VibeDoc, shows the board when it is ready, and quitting the app stops it
### S4: External links
- WHEN the user clicks a link to another site in the app
- THEN it opens in their default browser
