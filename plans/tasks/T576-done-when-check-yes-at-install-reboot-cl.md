# T576: Done-when check: yes at install, reboot, Claude Code still connected
**Status:** 👀 Review
**Phase:** R110 — Run in background on install
**Size:** S
**Depends on:** T574, T575
**Covers:** S1, S2, S3, S4
**Owner:** ai:claude
**Due:** 2026-10-21
**Started:** 2026-10-20

## Goal
Prove the epic's Done-when on a real machine: answer yes during install, reboot, and the already-connected Claude Code reaches VibeDoc without the user running any command. Then mark R110 done.

## Context
- Epic: `plans/roadmap/R110-background-on-install.md`
- This task only checks behaviour that spans T1–T3. Each of those tasks already landed its own tests and docs.
- The address must be the same after a reboot, so the user-scope MCP connection (`claude mcp add --transport http vibedoc <url>`) keeps working. It is the hub's stable port (R080/T534).

## Scope
- [ ] macOS: `curl … | sh` with y, `claude mcp add` (if not connected), reboot, then in Claude Code `vibedoc_get_status` answers (S1)
- [ ] Linux (VM or a desktop session with systemd): the same check
- [ ] Windows: the same check, if a machine is available; otherwise leave it as a manual test
- [ ] No at install (S2), `vibedoc login off` + reboot (S4) and `--uninstall` + reboot (S3): nothing starts at login
- [ ] Write the results into this task's Manual tests and set R110 to done

**Out of scope:** new code. If a check fails, fix it in the task that owns the code (T1–T3) and reopen it.

## Files
- none (results only)

## Acceptance criteria
- [ ] After a reboot with yes, Claude Code calls a VibeDoc tool at the same MCP URL without the user running a command (S1)
- [ ] After no, `login off` or uninstall, nothing VibeDoc is running after a reboot (S2, S3, S4)
- [ ] After `login off`, `~/.vibedoc` and the projects are untouched (S4)

## Verify
```bash
vibedoc login status
vibedoc status
claude mcp list | grep vibedoc
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S1 — WHEN the user answers yes during install and logs in again later → THEN VibeDoc is running in the background at its usual address
- [ ] S2 — WHEN the user answers no (or the install runs unattended) → THEN nothing starts at login and VibeDoc works as it does today
- [ ] S3 — WHEN the user uninstalls VibeDoc → THEN the background VibeDoc is stopped and nothing starts at the next login
- [ ] S4 — WHEN the user turns background start off from the terminal → THEN VibeDoc no longer starts at login, and the files and projects are untouched
- [ ] macOS: `curl … | sh`, answer y, `claude mcp add --transport http vibedoc http://localhost:3333/api/mcp` if not connected, reboot → in Claude Code, `vibedoc_get_status` answers without running any command
- [ ] Linux (systemd desktop): the same check
- [ ] Windows: the same check
### Regression risk
- [ ] After a reboot with start at login on, `vibedoc` in a repo adds that repo to the running hub instead of starting a second server
- [ ] _Done here instead of a reboot (macOS): a LaunchAgent made by `plist()` with a test label and a temp VIBEDOC_HOME was loaded with `launchctl bootstrap gui/<uid>` (what login does): the job ran `start --no-open` and exited 0, VibeDoc answered on :3333 after 3 s, MCP `tools/list` answered there, and after `launchctl bootout` (what `login off` does) VibeDoc kept running (AbandonProcessGroup) until `vibedoc stop`. T574 tested yes / no / unattended / update / uninstall with a local tarball. No reboot, no Linux, no Windows: those stay above for a human. Verify here: `login status` off, `status` not running (this machine runs the dev server, not `vibedoc start`), `claude mcp list` shows no vibedoc entry._
