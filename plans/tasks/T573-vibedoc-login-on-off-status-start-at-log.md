# T573: `vibedoc login on|off|status`: start at login on macOS, Linux, Windows
**Status:** 👀 Review
**Phase:** R110 — Run in background on install
**Size:** L
**Depends on:** —
**Covers:** S4
**Owner:** ai:claude
**Due:** 2026-10-27
**Started:** 2026-10-20

## Goal
`vibedoc login on` makes VibeDoc start in the background each time the user logs in, `vibedoc login off` stops that, and `vibedoc login status` reports which one is set. The installers (T2, T3) call this command, so the logic for each OS lives in one place.

## Context
- Epic: `plans/roadmap/R110-background-on-install.md`
- **Blocked on R109 (Background mode):** the login item runs `vibedoc start` (R109), which starts the hub in the background and returns. Restarting after a crash is R109's job, not the OS's. Don't start this task until `vibedoc start`, `stop` and `status` exist.
- Decisions from the interview:
  - **macOS:** a LaunchAgent at `~/Library/LaunchAgents/io.github.quanghoangf.vibedoc.plist`, with `RunAtLoad` true and `KeepAlive` false (`start` returns at once).
  - **Linux:** a systemd user unit `~/.config/systemd/user/vibedoc.service` with `Type=oneshot`, `RemainAfterExit=yes`, `ExecStart=<launcher> start`, `ExecStop=<launcher> stop` and `WantedBy=default.target`, enabled with `systemctl --user enable`. When `systemctl --user` is missing or fails (no systemd), fall back to the XDG autostart file `~/.config/autostart/vibedoc.desktop`.
  - **Windows:** the value `VibeDoc` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, written with `reg add` / `reg delete`. No admin rights needed.
- The login item must hold the **absolute** path of the launcher that is running now. From the one-line installer that is `~/.vibedoc/bin/vibedoc` (or `$VIBEDOC_HOME/bin/vibedoc`). From an npm global install, store `process.execPath` and the bin script path. Never write a bare `vibedoc`, because PATH is not set up at login.
- `off` only removes the login item. It does not stop a VibeDoc that is running now: it prints that VibeDoc keeps running until `vibedoc stop` or the next logout. It never touches `~/.vibedoc` data, projects or runs (S4).
- `bin/vibedoc.mjs` dispatches subcommands before any port/server logic, the way `check` does (T420). `--version` must keep working first (`bin/vibedoc.check.mts`).

## Scope
- [ ] `bin/login.mjs`: `loginOn()`, `loginOff()` and `loginStatus()`, with the platform, home folder and command runner injectable for tests
- [ ] Dispatch `vibedoc login on|off|status` in `bin/vibedoc.mjs`; an unknown action prints usage and exits 1
- [ ] `on` is idempotent: running it twice gives one item, and it rewrites the launcher path if that changed
- [ ] `status` prints `Start at login: on (<mechanism>, <file or key>)` or `Start at login: off`
- [ ] Docs: a "Start at login" section in `docs/getting-started.md` and the matching site docs page

**Out of scope:** the installer prompts (T2, T3); a Settings switch; a tray icon; the desktop app installer (R112).

## Files
- `bin/login.mjs` — new; the code for each OS
- `bin/vibedoc.mjs` — dispatch `login`
- `bin/login.test.mjs` (or the repo's usual test location) — unit tests
- `docs/getting-started.md`, `site/src/content/docs/docs/index.md` — the "Start at login" section

## Implementation notes
- Write the files directly (plist, unit, .desktop). Shell out only to `launchctl bootstrap gui/$UID` / `bootout` (macOS, best effort), `systemctl --user daemon-reload && enable` (Linux) and `reg` (Windows).
- Quote paths that contain spaces in the plist ProgramArguments, the unit `ExecStart` and the Run value (`"C:\...\vibedoc.cmd" start`).

## Acceptance criteria
- [ ] On macOS, `vibedoc login on` writes the plist with the absolute launcher and `start`; `login status` says on; `login off` removes the plist and status says off
- [ ] On Linux with systemd, the unit is written and enabled; without systemd, the .desktop file is written instead
- [ ] On Windows, the Run value is set and then removed (tested through the injected runner)
- [ ] `login off` leaves `~/.vibedoc` (other than the login item) and every project untouched (S4)
- [ ] Unit tests cover each OS with a temp HOME and a fake runner, plus `on` twice → one item
- [ ] `vibedoc --version` still runs first

## Verify
```bash
pnpm test
pnpm lint
node bin/vibedoc.mjs login status
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S4 — WHEN the user turns background start off from the terminal → THEN VibeDoc no longer starts at login, and the files and projects are untouched
- [ ] On macOS run `vibedoc login on`, log out and back in → `vibedoc status` says running, and no browser tab opened at login
- [ ] `vibedoc login status` → `Start at login: on (LaunchAgent, ~/Library/LaunchAgents/io.github.quanghoangf.vibedoc.plist)`
- [ ] `vibedoc login off` while VibeDoc runs → it keeps running; after the next login `vibedoc status` says not running
- [ ] On a Linux desktop with systemd, `vibedoc login on` → `systemctl --user is-enabled vibedoc` says enabled; log in again → VibeDoc runs
- [ ] On Windows, `vibedoc login on` → regedit shows the VibeDoc value under HKCU\…\Run; sign in again → VibeDoc runs
### Regression risk
- [ ] `vibedoc`, `vibedoc start`, `status`, `stop` and `--version` still behave as before
