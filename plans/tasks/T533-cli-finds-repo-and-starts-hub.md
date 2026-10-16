# T533: CLI finds the repo and starts the hub on one address
**Status:** 📋 Todo
**Phase:** R100 — Auto-detect current repo
**Size:** M (2–3 hrs)
**Depends on:** T529
**Covers:** S1, S3

## Goal
`npx vibedoc` works out which repo it was run in, starts one hub on a stable per-user port, and opens that repo (or All projects when it isn't in a repo).

## Context
- Epic: `plans/roadmap/R100-auto-detect-current-repo.md` (spec changes: `cli-startup`)
- Decision: repo root = the nearest ancestor with `.git` (dir or file, so worktrees count). The monorepo root wins over a package folder because the walk stops at `.git`, not at `package.json`. No `.git` up to `/` → not in a repo → open `/projects`.
- `bin/` ships unbuilt plain JS and can't import core: put the walk in `bin/repo-root.mjs` next to `bin/address.mjs`, with `bin/repo-root.check.mts`.
- Decision: the hub's port lives in `<home>/port` (`$VIBEDOC_HOME` or `~/.vibedoc`, T529), first free from 3333, replacing the per-project `.vibedoc/port` (R080). `readSavedPort` / `savePort` take the home dir instead of the root.
- The CLI never writes `hub.json`. On a cold start it passes the root to add as `VIBEDOC_ADD_ROOT`; core adds it to the hub on the first `readHub()`. `VIBEDOC_ROOT` stays the configured (default) project.
- Opens `/?project=<id>` (T530). The id isn't known before the server answers, so open `/?root=<abs>` and let `src/app/page.tsx` map root → id.

## Scope
- [ ] `bin/repo-root.mjs` `repoRoot(cwd)` (pure apart from `fs.existsSync`) + check
- [ ] `bin/address.mjs`: home-dir port; `startupBanner` prints the project's MCP URL `…/api/mcp?root=<encoded root>`
- [ ] `bin/vibedoc.mjs`: cwd → repo root (or none) → `VIBEDOC_ADD_ROOT`; open target `/?root=` or `/projects`
- [ ] core: `VIBEDOC_ADD_ROOT` added on first hub read; `src/app/page.tsx` handles `?root=` → `?project=`
- [ ] `docs/` / site getting-started: one paragraph "one VibeDoc for all your projects"

**Out of scope:** reusing a running hub (T534), migration message (T535).

## Files
- `bin/repo-root.mjs`, `bin/repo-root.check.mts` — new
- `bin/address.mjs` (+ `bin/address.check.mts`), `bin/vibedoc.mjs`
- `src/lib/core.ts` (hub read), `src/app/page.tsx`
- `site/src/content/docs/docs/index.md` (getting started)

## Acceptance criteria
- [ ] Run in `<repo>/packages/web` → opens `<repo>` (monorepo root), added to the hub
- [ ] Run in a folder with no `.git` above it → opens All projects
- [ ] Restart in the same repo → same app URL and same printed MCP URL (spec `Stable project address` / Restart)
- [ ] `node bin/repo-root.check.mts` and `node bin/address.check.mts` pass

## Manual tests
- [ ] S1 — WHEN the user runs `npx vibedoc` in a repo the hub doesn't know → THEN the repo is added to All projects and its board opens
- [ ] S3 — WHEN the user runs `npx vibedoc` outside any repo → THEN All projects opens

## Verify
```bash
node bin/repo-root.check.mts && node bin/address.check.mts
pnpm lint && pnpm build
VIBEDOC_HOME=$(mktemp -d) node bin/vibedoc.mjs --no-open   # in a scratch repo
```
