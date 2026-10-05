# R072: Install channels
**Parent:** R002
**Status:** in-progress
**Order:** 250
**Tasks:** T209

People install VibeDoc the way they already install tools, not only with npx, so it feels like a first-class CLI on every machine.

**In scope:** npx stays the default; global installs with npm, pnpm and bun; a Homebrew tap; the same version on every channel at each release; install, update and uninstall steps per channel
**Out of scope:** OS package managers beyond Homebrew (apt, winget, Scoop), a self-contained binary (One-line installer)
**Done when:** a new release can be installed and run with `vibedoc --version` from npx, npm, pnpm, bun and Homebrew, all reporting the same version

## Scenarios
### S1: Install with Homebrew
- WHEN a macOS or Linux user runs brew install for VibeDoc
- THEN `vibedoc --version` prints the latest release
### S2: Same version everywhere
- WHEN a release is published
- THEN every channel serves that version within a day
