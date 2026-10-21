# T585: Sign and notarize the desktop builds (blocked on credentials)
**Status:** ⏸️ Paused
**Phase:** R112 — Desktop installers & auto-update
**Size:** M
**Depends on:** T581
**Covers:** S1, S2
**Owner:** ai:claude
**Due:** 2026-10-24
**Started:** 2026-10-21

## Goal
macOS and Windows open the installers without an "unknown developer" block, and macOS auto-update works, because the builds are signed and the Mac build is notarized.

## Context
- Epic: `plans/roadmap/R112-desktop-installers-auto-update.md`
- **Blocked:** there are no signing credentials yet. This task needs an Apple Developer ID Application certificate plus an app-specific password and team id, and a Windows code-signing cert (OV/EV, or Azure Trusted Signing). They're stored as GitHub secrets. Start this task only once those exist.
- T-builds already reads the secrets and skips signing when they're absent. This task turns signing on and proves it.
- Without signing, Squirrel.Mac refuses updates, so S2 on macOS depends on this task.

## Scope
- [ ] Add the secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, and Windows `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (or the Azure Trusted Signing config)
- [ ] `electron-builder.yml`: `mac.hardenedRuntime: true`, entitlements (allow JIT, network client and server), `notarize: true`. Windows `signtoolOptions` / `azureSignOptions`
- [ ] The job fails if secrets are present but signing fails (no silent unsigned release once signing is on)
- [ ] Remove the macOS unsigned-update fallback note from the site docs (keep the code path)

**Out of scope:** app stores, Linux signing (AppImage runs without it).

## Files
- `desktop/electron-builder.yml`
- `desktop/build/entitlements.mac.plist`: new
- `.github/workflows/desktop.yml`

## Acceptance criteria
- [ ] `spctl -a -vv VibeDoc.app` → "accepted, source=Notarized Developer ID"
- [ ] Windows: the downloaded .exe shows the publisher name, and SmartScreen gives no "unknown publisher" block (EV/Trusted Signing) or only the reputation prompt (OV)
- [ ] macOS: from signed N, the one-click update to signed N+1 works (T-install's flow, no fallback)

## Verify
```bash
codesign --verify --deep --strict -v VibeDoc.app
spctl -a -vv VibeDoc.app
# Windows: Get-AuthenticodeSignature .\VibeDoc-Setup.exe
```

## Manual tests
_2026-10-20 — human_
### Steps
- [ ] S1 — WHEN a user downloads the installer for their OS and opens it → THEN VibeDoc installs and opens with no security warning that blocks it
- [ ] S2 — WHEN a newer release exists → THEN the app says so with its release notes, and one click installs it and reopens the app on the new version

## Blocked because
_2026-10-21 — ai:claude_
- No signing credentials exist: no Apple Developer ID Application certificate (+ app-specific password, team id) and no Windows code-signing certificate (OV/EV or Azure Trusted Signing). The task says to start only once they are GitHub secrets.
- A human must: get the certificates, add `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` (or the Azure Trusted Signing config) as repo secrets, then unblock this task.
- Already in place from T581/T583: `desktop.yml` passes those secrets through (empty ones unset), `desktop/scripts/dist.mjs` builds unsigned and says so when they are missing, and the app's update card falls back to the release page when macOS refuses an unsigned update.

## Paused
_2026-10-21 — human decision_
- Users install from the terminal (`install.sh`, `vibedoc start`, `vibedoc login on`); paying for Apple / Windows certificates is not worth it now. The desktop app ships unsigned as a beta. Resume when signing is wanted.
