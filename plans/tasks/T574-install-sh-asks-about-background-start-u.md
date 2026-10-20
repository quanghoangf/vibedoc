# T574: install.sh asks about background start; --update and --uninstall handle it
**Status:** 👀 Review
**Phase:** R110 — Run in background on install
**Size:** M
**Depends on:** T573
**Covers:** S1, S2, S3
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
On macOS and Linux the one-line installer asks once, "Keep VibeDoc running in the background and start it when you log in? [y/N]". On yes it turns on start at login and starts VibeDoc right away. `--update` keeps that choice and `--uninstall` removes it.

## Context
- Epic: `plans/roadmap/R110-background-on-install.md`
- The installer is `site/public/install.sh` (T213): POSIX sh, `VIBEDOC_HOME` and `VIBEDOC_VERSION`, and a PATH question that defaults to no and is never asked when nobody is at the keyboard. Ask this new question the same way, reading from `/dev/tty` because stdin is the curl pipe.
- Decision: `VIBEDOC_BACKGROUND=1` answers yes and `VIBEDOC_BACKGROUND=0` answers no, without asking (for scripts). With no TTY and no env var the answer is no (S2).
- All the OS work goes through T1: `"$VIBEDOC_HOME/bin/vibedoc" login on|off` and `vibedoc start|stop` (R109). The script writes no plist or unit itself.

<!-- vibedoc:steps -->
- **Install** — download Node and the package, then the PATH question
- **Ask** — the background question (or `VIBEDOC_BACKGROUND`), default N
- **Yes** — `vibedoc login on`, then `vibedoc start`, which prints the address
- **--update** — if `login status` is on: `stop`, replace, `start`
- **--uninstall** — `stop`, `login off`, then remove files

## Scope
- [ ] The question appears after a successful install. On yes, run `login on` and `start`, then print the address and that it starts at login. On no, nothing changes from today's install.
- [ ] `--update`: when `login status` says on, stop before replacing and start after. The login item still points to the same launcher, so it is not asked again.
- [ ] `--uninstall`: `vibedoc stop` and `vibedoc login off` before removing `node`, `lib` and `bin`. A failure in either is a warning, not an abort.
- [ ] Docs: the installer section in `docs/getting-started.md` and the site docs mention the question and `VIBEDOC_BACKGROUND`

**Out of scope:** Windows (T3); a Settings switch.

## Files
- `site/public/install.sh` — the question, the env var, and the update and uninstall steps
- `docs/getting-started.md`, `site/src/content/docs/docs/index.md`, `README.md` — one line each

## Acceptance criteria
- [ ] `VIBEDOC_HOME=<tmp> VIBEDOC_BACKGROUND=1 sh install.sh </dev/null` → `login status` says on and VibeDoc answers at its address (S1, right after install)
- [ ] `</dev/null` with no env var → no login item, nothing started (S2)
- [ ] `VIBEDOC_BACKGROUND=0` → no question, no login item (S2)
- [ ] `--update` with background on → running again afterwards and still on at login
- [ ] `--uninstall` → no VibeDoc process, no login item, and the files are removed as before (S3)
- [ ] `sh -n` passes and the script is shellcheck-clean

## Verify
```bash
sh -n site/public/install.sh
T=$(mktemp -d); VIBEDOC_HOME=$T VIBEDOC_BACKGROUND=1 sh site/public/install.sh </dev/null && $T/bin/vibedoc login status && $T/bin/vibedoc status
VIBEDOC_HOME=$T sh site/public/install.sh --uninstall </dev/null; ls ~/Library/LaunchAgents | grep -c vibedoc
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [x] S1 — WHEN the user answers yes during install and logs in again later → THEN VibeDoc is running in the background at its usual address
- [x] S2 — WHEN the user answers no (or the install runs unattended) → THEN nothing starts at login and VibeDoc works as it does today
- [x] S3 — WHEN the user uninstalls VibeDoc → THEN the background VibeDoc is stopped and nothing starts at the next login
- [ ] In a real terminal, `curl -fsSL …/install.sh | sh` → after the PATH question it asks "Keep VibeDoc running in the background and start it when you log in? [y/N]"; Enter → "Not running VibeDoc in the background…"
- [ ] Answer y → "✓ VibeDoc is running in the background at http://localhost:<port>" and "VibeDoc starts in the background when you log in"; log out and in → `vibedoc status` says running, no browser tab opened
- [ ] `sh -s -- --update` with background on → no question, VibeDoc is running again afterwards
- [ ] `sh -s -- --uninstall` → VibeDoc is stopped and ~/Library/LaunchAgents has no io.github.quanghoangf.vibedoc.plist
### Regression risk
- [ ] The PATH question still works as before (y adds the line, Enter leaves the shell file alone)
- [ ] _Tested here with a local tarball (VIBEDOC_VERSION=file:…tgz) and a temp HOME/VIBEDOC_HOME on macOS, no TTY: S1 via VIBEDOC_BACKGROUND=1 (login on, :3333 answered), --update (old supervisor gone, new one running, still on), --uninstall (no process, no plist), S2 unset and =0 (off, nothing started). Not run: the interactive /dev/tty prompt, Linux, shellcheck (not installed). Also fixed `$VERSION…`, which sh read as a longer variable name outside a UTF-8 locale._
