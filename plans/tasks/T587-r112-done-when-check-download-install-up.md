# T587: R112 Done-when check: download, install, update from inside the app
**Status:** ⏸️ Paused
**Phase:** R112 — Desktop installers & auto-update
**Size:** S
**Depends on:** T583, T584, T585, T586
**Covers:** S1, S2, S3

## Goal
Prove the epic's Done-when end to end on a clean machine: a user with no developer tools downloads the app, installs it, and later gets the next release from inside the app with one click.

## Context
- Epic: `plans/roadmap/R112-desktop-installers-auto-update.md`
- Use a clean VM or a user account per OS with no Node, no git and no terminal install, plus one run with the terminal install present for S3.
- Needs two real releases (N and N+1) produced by the release workflow.

## Scope
- [ ] macOS, Windows, Linux: download from the site's install page → open → VibeDoc shows the board with no blocking security warning
- [ ] Publish N+1 → each installed app shows the banner and notes, one click updates and reopens on N+1
- [ ] With the terminal install running in the background → the app uses it, and only one VibeDoc process runs
- [ ] Record findings in the task's Manual tests. Mark R112 done only when all three scenarios pass

**Out of scope:** new features. File gaps as follow-up tasks.

## Files
- none expected (fixes go in follow-up tasks)

## Acceptance criteria
- [ ] S1, S2 and S3 pass on macOS, Windows and Linux (AppImage)
- [ ] The epic's Done-when holds for a user with no developer tools

## Verify
```bash
# manual on clean VMs; record version numbers before/after and `ps` output for S3
```

## Manual tests
_2026-10-20 — human_
### Steps
- [ ] S1 — WHEN a user downloads the installer for their OS and opens it → THEN VibeDoc installs and opens with no security warning that blocks it
- [ ] S2 — WHEN a newer release exists → THEN the app says so with its release notes, and one click installs it and reopens the app on the new version
- [ ] S3 — WHEN the user also has the terminal install running in the background → THEN the desktop app uses that VibeDoc instead of starting a second one
