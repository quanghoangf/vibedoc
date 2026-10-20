# T586: Desktop downloads on the site's install page and in the docs
**Status:** 👀 Review
**Phase:** R112 — Desktop installers & auto-update
**Size:** S
**Depends on:** T581
**Covers:** S1
**Owner:** ai:claude
**Due:** 2026-10-22
**Started:** 2026-10-21

## Goal
The site's install page offers a desktop app download for the visitor's OS, which links to the latest release's file, and the docs explain installing and updating the app.

## Context
- Epic: `plans/roadmap/R112-desktop-installers-auto-update.md`
- The site is in `site/` (Astro/Starlight, deployed by `.github/workflows/site.yml`). The install page already has per-channel tabs (T209 added Homebrew).
- Link to `https://github.com/quanghoangf/vibedoc/releases/latest/download/<file>`. Asset names are fixed, without the version, in `electron-builder.yml` `artifactName` so these URLs never change.
- Until T-sign lands, the macOS/Windows docs have to say how to open an unsigned build (right-click → Open, or System Settings → Privacy & Security; SmartScreen → More info → Run anyway).

## Scope
- [ ] Set a stable `artifactName` per target in `desktop/electron-builder.yml` (e.g. `VibeDoc-mac-universal.dmg`, `VibeDoc-Setup.exe`, `VibeDoc-x86_64.AppImage`)
- [ ] Install page: a "Desktop app" tab/section with three download buttons. Detect the OS from the user agent and highlight its button
- [ ] A new docs page `site/src/content/docs/docs/desktop-app.md`: install, first run, updates, side by side with the terminal install, and the unsigned-build workaround
- [ ] Link the downloads from the README install section

**Out of scope:** download analytics (R077).

## Files
- `desktop/electron-builder.yml`: artifactName
- `site/src/content/docs/…/install` page: the desktop section
- `site/src/content/docs/docs/desktop-app.md`: new
- `README.md`

## Acceptance criteria
- [ ] On macOS the install page highlights the .dmg button, and clicking it downloads the latest release's .dmg
- [ ] All three `/releases/latest/download/...` links resolve (HTTP 302 → asset)
- [ ] The desktop-app docs page is in the site's sidebar, and `vibedoc_check_docs` is clean

## Verify
```bash
pnpm --dir site run build
curl -sI https://github.com/quanghoangf/vibedoc/releases/latest/download/VibeDoc-Setup.exe | head -1
```

## Manual tests
_2026-10-20 — ai_
### Steps
- [ ] S1 — WHEN a user downloads the installer for their OS and opens it → THEN VibeDoc installs and opens with no security warning that blocks it
- [ ] On a Mac, open the site’s home page → the install box has a "Desktop app" tab; in it "macOS · Apple silicon" is highlighted
- [ ] After the next release: click each of the four buttons → each downloads that file (`curl -sI …/releases/latest/download/VibeDoc-Setup.exe` → 302)
- [ ] The docs sidebar → Desktop app: install per OS, the first-open workaround, updates, next to the terminal install
- [ ] README: the desktop app line links the four downloads
### Regression risk
- [ ] The other install tabs still show and copy their command
- [ ] _Site builds and its 42 tests pass, including the new ones: the Desktop app tab links all four `/releases/latest/download/<file>` URLs, and with a Mac / Linux / iPhone user agent exactly the Mac / Linux / no button is highlighted (`site/src/scripts/visitor-os.check.mts` too). A rebuilt mac dist names the files `VibeDoc-mac-arm64.dmg`, `VibeDoc-mac-x64.dmg` and the zips, and latest-mac.yml points at them. Not checkable yet: the links resolve only once a release carries these names (no release has been pushed). An Intel Mac also gets Apple silicon highlighted (the browser doesn’t say the chip); both buttons stay._
