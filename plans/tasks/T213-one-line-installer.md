# T213: One-line installer with a private Node
**Status:** 📋 Todo
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
- [ ] Landing page: "No Node?" line under the install tabs with the one-liner; docs Getting started gets the channel; README
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
