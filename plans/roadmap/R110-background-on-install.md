# R110: Run in background on install
**Parent:** R002
**Status:** in-progress
**Order:** 510
**Tasks:** T573, T574, T575, T576

When someone installs VibeDoc with the one-line command, they choose once whether it should always be there in the background, so after a reboot VibeDoc is just running and their agents stay connected.

**In scope:** the one-line installers (macOS, Linux, Windows) ask "Keep VibeDoc running in the background and start it when you log in?" (default no, never asked when nobody is at the keyboard, an env var answers it for scripts); yes → VibeDoc starts at login on each OS and right after install; uninstall and `--update` keep or remove it correctly; a way to turn it off later from the terminal
**Out of scope:** a Settings switch for start at login, the desktop app's own installer (R112), a menu bar / tray icon
**Done when:** a user answers yes during install, reboots, and their already-connected Claude Code works with VibeDoc without running any command

## Scenarios
### S1: Yes at install
- WHEN the user answers yes during install and logs in again later
- THEN VibeDoc is running in the background at its usual address
### S2: No at install
- WHEN the user answers no (or the install runs unattended)
- THEN nothing starts at login and VibeDoc works as it does today
### S3: Uninstall
- WHEN the user uninstalls VibeDoc
- THEN the background VibeDoc is stopped and nothing starts at the next login
### S4: Turn it off later
- WHEN the user turns background start off from the terminal
- THEN VibeDoc no longer starts at login, and the files and projects are untouched
