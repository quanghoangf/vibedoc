# T213: One-line installer with a private Node
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-05
**Phase:** R076 — One-line installer
**Size:** L (half a day)
**Depends on:** —

## Goal
On a machine with no Node, `curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh` (or the PowerShell equivalent on Windows) installs VibeDoc, and `vibedoc --version` runs.

## Context
- Epic: `plans/roadmap/R076-one-line-installer.md`.
- Decision: no compiled binary. The script downloads the official Node binary (LTS, from nodejs.org, checksum-verified against SHASUMS256.txt) into `~/.vibedoc/node`, installs the `vibedoc` npm package with that Node into `~/.vibedoc/lib`, and writes a launcher `~/.vibedoc/bin/vibedoc`. Same version as npm, no new release pipeline.
- PATH: ask first (y/N; non-interactive = don't touch, print the line to add). Only the installer may append the PATH line, because the user said yes.
- Served from the site: `site/public/install.sh`, `site/public/install.ps1`.

## Scope
- [ ] `install.sh` (macOS, Linux; x64 + arm64): install, `--update` (reinstall latest), `--uninstall` (remove `~/.vibedoc/{node,lib,bin}`, never the user's projects or runs); `VIBEDOC_HOME` overrides the folder; `VIBEDOC_VERSION` pins a version
- [ ] `install.ps1` (Windows x64 / arm64) with the same steps, PATH via the user environment variable after asking
- [ ] Landing page: a "No Node" install tab with the one-liner (Windows command in its note); docs Getting started gets the channel; README
- [ ] Check: run `install.sh` against a temp `VIBEDOC_HOME` → `vibedoc --version` prints the npm version; `--uninstall` removes it

**Out of scope:** OS package repos, background auto-update.

## Acceptance criteria
- [ ] `sh install.sh` with `VIBEDOC_HOME=<tmp>` installs and `<tmp>/bin/vibedoc --version` prints the latest npm version, without using any Node on PATH
- [ ] The script verifies the Node download's sha256 and stops on mismatch
- [ ] Non-interactive runs never edit shell files
- [ ] `shellcheck`-clean POSIX sh (when shellcheck is available)

## Verify
```bash
sh -n site/public/install.sh
VIBEDOC_HOME=$(mktemp -d) sh site/public/install.sh </dev/null
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
### Steps
- [x] Ran `env -i HOME=<tmp> PATH=/usr/bin:/bin VIBEDOC_HOME=<tmp> sh site/public/install.sh </dev/null` (no Node on PATH) → Node 22 downloaded and verified, "Installed VibeDoc 1.14.0", no shell file written (non-interactive)
- [x] Started the installed launcher with `--port 4499` (still no Node on PATH) → the server came up and `/api/mcp` tools/list answered
- [x] `install.sh --uninstall` → node, lib and bin removed; the folder's other contents untouched
- [x] 🤖 The landing page "No Node" tab shows and copies the curl one-liner; /install.sh and /install.ps1 are served
- [ ] In a real terminal: `curl -fsSL https://quanghoangf.github.io/vibedoc/install.sh | sh` → it asks "Add … to your PATH in ~/.zshrc? [y/N]"; y adds one line ending in `# vibedoc`, and a new terminal runs `vibedoc --version`
- [ ] Windows: `irm https://quanghoangf.github.io/vibedoc/install.ps1 | iex` in PowerShell → installs, asks about the user PATH, `vibedoc --version` works in a new terminal (not run: no Windows / PowerShell here)
### Regression risk
- [ ] The other install tabs still copy their own command
