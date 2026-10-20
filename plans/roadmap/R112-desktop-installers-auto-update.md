# R112: Desktop installers & auto-update
**Parent:** R002
**Status:** in-progress
**Order:** 530
**Tasks:** T581, T582, T583, T584, T585, T586, T587

People install the VibeDoc desktop app by downloading a file, with no terminal, and stay on the latest version without thinking about it.

**In scope:** a download for macOS (.dmg), Windows (.exe) and Linux, from the site's install page and each GitHub release; the OS opens it without "unknown developer" blocks; the app checks for a new version, shows what changed, and updates after one click (restarting a background VibeDoc it uses); the terminal install and the desktop app can live side by side without two VibeDocs fighting over the address
**Out of scope:** OS app stores, silent updates without asking, a menu bar / tray icon
**Done when:** a user with no developer tools downloads the app, installs it, and later gets the next release from inside the app with one click

## Scenarios
### S1: Install from a download
- WHEN a user downloads the installer for their OS and opens it
- THEN VibeDoc installs and opens with no security warning that blocks it
### S2: Update available
- WHEN a newer release exists
- THEN the app says so with its release notes, and one click installs it and reopens the app on the new version
### S3: Side by side with the CLI
- WHEN the user also has the terminal install running in the background
- THEN the desktop app uses that VibeDoc instead of starting a second one
