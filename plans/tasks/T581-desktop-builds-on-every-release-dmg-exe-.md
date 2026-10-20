# T581: Desktop builds on every release: .dmg, .exe, AppImage attached to the GitHub release
**Status:** 👀 Review
**Phase:** R112 — Desktop installers & auto-update
**Size:** L
**Depends on:** —
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-27
**Started:** 2026-10-20

## Goal
Every VibeDoc release publishes a macOS .dmg, a Windows .exe (NSIS) and a Linux AppImage for the desktop app to its GitHub release, along with the `latest*.yml` update feeds that electron-updater reads.

## Context
- Epic: `plans/roadmap/R112-desktop-installers-auto-update.md`
- Requires the R111 Electron app (no tasks for it yet). This plan assumes it lives in `desktop/` with its own `package.json` and main process. If R111 lands somewhere else, change the paths here.
- Decision: Electron + electron-builder. Linux ships as AppImage only, since that's the only Linux target electron-updater can update in place.
- Decision: there are no signing credentials yet. The signing config is wired in but runs only when its secrets are set (T-sign), so builds work unsigned today.
- Releases: `semantic-release` in `.github/workflows/release.yml` already publishes to npm and pushes the Homebrew formula (T209). Desktop builds follow it.

## Scope
- [ ] `desktop/electron-builder.yml`: appId, productName "VibeDoc", icons, targets `dmg` (x64 + arm64, or universal), `nsis` (oneClick, per-user), `AppImage`. Use `publish: github` so `latest.yml`, `latest-mac.yml` and `latest-linux.yml` are generated
- [ ] The app version comes from the root `package.json` version that semantic-release bumps
- [ ] Bundle the VibeDoc server the app starts (the R111 entry) in `extraResources` / asar, so the app runs on a machine without Node
- [ ] `.github/workflows/release.yml` (or a new `desktop.yml` that release.yml dispatches, like it does `site.yml`): a matrix on macos-latest, windows-latest and ubuntu-latest that builds after a release that changed the version and uploads the artifacts to that release's GitHub release
- [ ] Read the signing env vars (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CSC_LINK`) from secrets. When they're missing, set `CSC_IDENTITY_AUTO_DISCOVERY=false` and build unsigned without failing the job
- [ ] `desktop/package.json` scripts: `dist` (current OS) and `dist:all`

**Out of scope:** signing and notarization (T-sign), update UI (T-update-ui), site download buttons (T-site).

## Files
- `desktop/electron-builder.yml`: new
- `desktop/package.json`: electron-builder dev dep, dist scripts
- `.github/workflows/release.yml` and/or `.github/workflows/desktop.yml`: build matrix and upload
- `desktop/build/`: icons (icns, ico, png)

## Implementation notes
- The release commit carries `[skip ci]`, so release.yml has to dispatch the desktop workflow itself (same pattern as the `site.yml` dispatch in T212, `actions: write`).
- Give the build the git tag (`v${version}`) so electron-builder uploads to the existing release instead of creating a draft (`releaseType: release`).

## Acceptance criteria
- [ ] `pnpm --dir desktop run dist` on macOS produces a .dmg that opens VibeDoc on a machine without Node (right-click → Open while it's unsigned)
- [ ] A release run attaches `.dmg`, `.exe`, `.AppImage`, `latest.yml`, `latest-mac.yml` and `latest-linux.yml` to the GitHub release
- [ ] The job passes with no signing secrets set and logs "unsigned build"
- [ ] The web app and the npm package build exactly as before (`pnpm run build`)

## Verify
```bash
pnpm run build
pnpm --dir desktop run dist
# open desktop/dist/*.dmg (or .exe / .AppImage) → app opens on the board
gh workflow run desktop.yml --ref main   # dry run on a test tag
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S1 — WHEN a user downloads the installer for their OS and opens it → THEN VibeDoc installs and opens with no security warning that blocks it
- [ ] On a Mac, open `desktop/dist/VibeDoc-<version>-arm64.dmg`, drag VibeDoc to Applications, right-click → Open → "Starting VibeDoc…", then the first screen; the menu says "started by this app"
- [ ] The same with the Intel `.dmg` on an Intel Mac (or Rosetta)
- [ ] Dispatch `desktop.yml` with an existing version → the release gets the `.dmg`s, `.zip`s, `.exe`, `.AppImage`, `latest.yml`, `latest-mac.yml`, `latest-linux.yml`; each job logs "unsigned build" and passes
- [ ] On Windows, run the `.exe` from the release → VibeDoc installs for the user without admin and opens
- [ ] On Linux, `chmod +x` the `.AppImage` and run it → VibeDoc opens
### Regression risk
- [ ] The next real release still publishes to npm and updates Homebrew (release.yml gained one step)
- [ ] _Built here on macOS (unsigned): `node desktop/scripts/dist.mjs` made arm64 + x64 `.dmg` and `.zip` and `latest-mac.yml` (~290 MB each); the x64 app has `@next/swc-darwin-x64` and `@img/sharp-darwin-x64`. Ran the arm64 packaged app, and the app inside the mounted arm64 dmg, with PATH=/usr/bin:/bin (no Node): it started its own VibeDoc and opened /start, and quitting left nothing listening. `pnpm build`, lint (same 13 old problems) and `e2e/desktop-app.mjs` from source pass. Not run: the GitHub workflow (nothing is pushed), Windows, Linux. Notes: electron-builder leaves node_modules out of extraResources, so the server is copied in afterPack; source maps are dropped (−140 MB). The server is the npm package as published, ~750 MB unpacked: Next standalone output would make it much smaller._
