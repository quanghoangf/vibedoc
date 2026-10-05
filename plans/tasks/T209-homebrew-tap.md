# T209: Homebrew tap, released with every version
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-05
**Phase:** R072 — Install channels
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S1, S2

## Goal
`brew install quanghoangf/vibedoc/vibedoc` installs the same version npm serves, and every release bumps the formula on its own, so Homebrew is a first-class channel next to npx, npm, pnpm and bun.

## Context
- Epic: `plans/roadmap/R072-install-channels.md`. npx, npm, pnpm and bun already work (`bin/vibedoc.mjs`, `vibedoc --version`); Homebrew is the missing channel.
- Decision: a separate tap repo `github.com/quanghoangf/homebrew-vibedoc` (one-command install). The release workflow pushes the formula there with a `HOMEBREW_TAP_TOKEN` secret (fine-grained PAT, contents: write on that repo). The human creates the repo and the secret.
- Releases: `semantic-release` in `.github/workflows/release.yml` publishes to npm and bumps `package.json`.

## Scope
- [ ] `packaging/homebrew/vibedoc.rb.tmpl`: npm-tarball formula (`depends_on "node"`, `npm install *std_npm_args`, test runs `vibedoc --version`)
- [ ] `scripts/homebrew-formula.mjs <version> <out>`: fetch the npm tarball, compute its sha256, render the formula
- [ ] `release.yml`: after a release that changed the version, render the formula and push it to the tap (skipped with a notice when the secret is missing)
- [ ] Homebrew tab on the landing page (`site/src/data/install.ts`), README install section, `docs/getting-started.md`

**Out of scope:** homebrew-core submission, apt/winget/Scoop, a self-contained binary (R076).

## Files
- `packaging/homebrew/vibedoc.rb.tmpl` — new
- `scripts/homebrew-formula.mjs` — new; `scripts/homebrew-formula.check.mts` renders against a fixed version/sha
- `.github/workflows/release.yml` — tap step
- `site/src/data/install.ts`, `README.md`, `docs/getting-started.md`

## Acceptance criteria
- [ ] `node scripts/homebrew-formula.mjs 1.14.0 /tmp/vibedoc.rb` writes a formula with the 1.14.0 tarball URL and its real sha256
- [ ] The release job pushes `Formula/vibedoc.rb` to the tap only when the version changed
- [ ] The landing page install tabs include Homebrew; site tests pass
- [ ] Docs say how to install, update (`brew upgrade vibedoc`) and uninstall per channel

## Verify
```bash
node scripts/homebrew-formula.check.mts
node scripts/homebrew-formula.mjs 1.14.0 /tmp/vibedoc.rb && ruby -c /tmp/vibedoc.rb
pnpm --dir site exec playwright test
```

## Manual tests
### Steps
- [ ] Human setup: create the public repo github.com/quanghoangf/homebrew-vibedoc (empty), and add the repo secret `HOMEBREW_TAP_TOKEN` (fine-grained PAT, Contents: read and write on that repo) to quanghoangf/vibedoc
- [ ] S1 — WHEN a macOS or Linux user runs brew install for VibeDoc → THEN `vibedoc --version` prints the latest release (after the next release: `brew install quanghoangf/vibedoc/vibedoc && vibedoc --version`)
- [ ] S2 — WHEN a release is published → THEN every channel serves that version within a day (the Release run shows "Update Homebrew tap" pushed `vibedoc <version>`; `npm view vibedoc version` matches)
- [x] 🤖 Open the landing page install card and pick Homebrew → it shows and copies `brew install quanghoangf/vibedoc/vibedoc`
- [ ] On a phone width the Homebrew command wraps inside the card instead of being cut off
### Regression risk
- [ ] A release with no version change (e.g. a `docs:` commit) skips the tap step and still succeeds

## Blocked on a human
The tap repo and the `HOMEBREW_TAP_TOKEN` secret (step 1). Until they exist, the release logs a notice and skips Homebrew; npm is unaffected.
