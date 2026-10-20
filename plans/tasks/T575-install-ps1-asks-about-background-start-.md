# T575: install.ps1 asks about background start; update and uninstall handle it
**Status:** 👀 Review
**Phase:** R110 — Run in background on install
**Size:** M
**Depends on:** T573
**Covers:** S1, S2, S3
**Owner:** ai:claude
**Due:** 2026-10-23
**Started:** 2026-10-20

## Goal
The Windows one-line installer asks the same background question as `install.sh` and behaves the same on yes, on no, on update and on uninstall.

## Context
- Epic: `plans/roadmap/R110-background-on-install.md`
- The installer is `site/public/install.ps1` (T213). It mirrors `install.sh` and already asks about the user PATH. Ask this question the same way. Treat the run as unattended when `[Environment]::UserInteractive` is false or input is redirected.
- The same `VIBEDOC_BACKGROUND=1|0` env var as T2.
- The Run key is written by `vibedoc login on` (T1), not by the script.

## Scope
- [ ] The question after install, default N. Yes → `vibedoc login on`, then `vibedoc start`, then print the address.
- [ ] Update: if `login status` is on, stop, replace, then start.
- [ ] Uninstall: `vibedoc stop` and `vibedoc login off` before removing files, warning on failure.
- [ ] Docs: the Windows note in the installer docs names the question and the env var

**Out of scope:** macOS and Linux (T2); a Startup folder shortcut or Scheduled Task.

## Files
- `site/public/install.ps1`
- `docs/getting-started.md` and the site docs page (the Windows note)

## Acceptance criteria
- [ ] With `VIBEDOC_BACKGROUND=1`: the Run value `VibeDoc` exists and VibeDoc answers at its address (S1)
- [ ] Unattended with no env var, or with `VIBEDOC_BACKGROUND=0` → no Run value (S2)
- [ ] Uninstall → no Run value and no VibeDoc process (S3)
- [ ] PowerShell parses the script (`[System.Management.Automation.Language.Parser]::ParseFile` reports no errors)
- [ ] If no Windows machine is available, the Windows steps are listed as manual tests, not claimed

## Verify
```powershell
$env:VIBEDOC_HOME = (New-Item -ItemType Directory -Path (Join-Path $env:TEMP vd)).FullName
$env:VIBEDOC_BACKGROUND = '1'; ./site/public/install.ps1
reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v VibeDoc
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S1 — WHEN the user answers yes during install and logs in again later → THEN VibeDoc is running in the background at its usual address
- [ ] S2 — WHEN the user answers no (or the install runs unattended) → THEN nothing starts at login and VibeDoc works as it does today
- [ ] S3 — WHEN the user uninstalls VibeDoc → THEN the background VibeDoc is stopped and nothing starts at the next login
- [ ] On Windows, `irm …/install.ps1 | iex` → after "Installed VibeDoc" it asks "Keep VibeDoc running in the background and start it when you log in? [y/N]"; y → "✓ VibeDoc is running in the background at http://localhost:<port>"
- [ ] Then `reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v VibeDoc` → the value is `"C:\Users\<you>\.vibedoc\bin\vibedoc.cmd" start --no-open`; sign out and in → `vibedoc status` says running
- [ ] `$env:VIBEDOC_BACKGROUND = "0"` before installing → no question, no Run value
- [ ] `-Update` with background on → no question, VibeDoc running again afterwards (no "file in use" error while replacing lib)
- [ ] `-Uninstall` → no node.exe of VibeDoc running and no VibeDoc Run value
### Regression risk
- [ ] The PATH question on install and on uninstall still works as before
- [ ] _No Windows machine here: only parsed with PowerShell 7.4 (`Parser::ParseFile`, 0 errors). Every Windows step above is unverified. Note: `vibedoc stop` (R109) finds child processes with `ps`, which Windows lacks; whether stop ends the whole tree on Windows is untested._
