# T136: vibedoc --version / -v in the CLI
**Status:** ✅ Done
**Phase:** R025 — vibedoc --version flag
**Size:** S
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-05
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
`npx vibedoc --version` (or `-v`) prints the installed VibeDoc version and exits, without starting the server or the wizard. Users can then check which build they are running.

## Context
- Epic: `plans/roadmap/R025-vibedoc-version-flag.md`
- The version comes from VibeDoc's own `package.json`, read with `createRequire`. The CLI already reads `../lib/templates.json` the same way (T028).
- `bin/vibedoc.mjs` is plain JavaScript ESM and standalone. Don't import from `src/` (T028 "Do NOT").
- The CLI already parses `--port` (README L37). Add the new flag next to that parsing.

## Scope
- [ ] Handle `--version` and `-v` in `bin/vibedoc.mjs` **before** any other work: no port lookup, no wizard, no `next start`
- [ ] Print only the bare version (e.g. `1.4.2`) plus a newline to stdout, then exit with code 0
- [ ] Add a check script that spawns the bin and asserts its output
- [ ] README CLI section: add `npx vibedoc --version`

**Out of scope:** `--help`, update checks against npm, and the version in the UI (next task).

## Files
- `bin/vibedoc.mjs`: early flag check at the top of the arg handling
- `bin/vibedoc.check.mts` (or next to the other `*.check.mts` files, following their location): new
- `README.md`: add the flag to the block near the `--port` example

## Implementation notes
- `const { version } = require('../package.json')`. `require` is already created through `createRequire(import.meta.url)`.
- Resolve the path relative to the bin file, not `process.cwd()`. Otherwise it prints the *target project's* version.
- Use `process.argv.slice(2).some(a => a === '--version' || a === '-v')`. Put the check above any `@clack/prompts` `intro()` call so no wizard UI is printed.
- Check script: `spawnSync(process.execPath, ['bin/vibedoc.mjs', '--version'])`. Assert stdout.trim() === package.json version and status === 0. Repeat for `-v`. Run it from a temp cwd to prove it doesn't read the cwd's package.json.

## Acceptance criteria
- [ ] `node bin/vibedoc.mjs --version` prints exactly the `version` from VibeDoc's `package.json` and exits 0
- [ ] `-v` behaves the same
- [ ] Run from another project directory, it still prints VibeDoc's version, not that project's
- [ ] No server starts and no port is picked when the flag is present
- [ ] Check script passes; README documents the flag

## Verify
```bash
node bin/vibedoc.mjs --version
node bin/vibedoc.mjs -v
(cd /tmp && node "$OLDPWD/bin/vibedoc.mjs" --version)
node bin/vibedoc.check.mts
npm run lint && npm run build
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] In a different project that has its own package.json with another version, run `node /path/to/vibedoc/bin/vibedoc.mjs -v`. It prints VibeDoc's version (1.12.0), not that project's version.
- [ ] Run `node bin/vibedoc.mjs --version` while another VibeDoc is already running. It prints the version straight away: no "Starting VibeDoc..." banner, no browser tab, no `next start` process (check with `ps aux | grep "next start"`).
- [ ] Run `node bin/vibedoc.mjs --port 3333 -v`. It prints only the version and exits, even with `--port` given.
- [ ] Open README.md, Options section. `npx vibedoc --version` appears under the `--port` example.
### Regression risk
- [ ] `node bin/vibedoc.mjs` with no flags still starts the server on a random port and opens /setup.
- [ ] `node bin/vibedoc.mjs --port 3333` still starts on port 3333.
- [ ] `bin/vibedoc.mjs` keeps its CRLF line endings, and `git diff` shows only the 9 added lines.
