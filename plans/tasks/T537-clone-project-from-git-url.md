# T537: Clone a project from a git URL
**Status:** 📋 Todo
**Phase:** R101 — Import projects
**Size:** M (2–3 hrs)
**Depends on:** T536
**Covers:** S2

## Goal
The user pastes a git URL, picks a parent folder, and the repo is cloned there and opened in the hub, or the clone error is shown in words.

## Context
- Epic: `plans/roadmap/R101-import-projects.md`
- Trust boundary: accept only `https://…`, `ssh://…` and `git@host:path` URLs; run `execFile('git', ['clone', '--', url, dest])` (never a shell, `--` stops option injection); refuse an existing `dest`.
- Process-only module like `src/lib/claude-cli.ts`: new `src/lib/git-clone.ts` (no fs; core passes paths). Timeout 5 min; Cancel kills it.
- Progress: `git clone --progress` writes to stderr; stream the last line over SSE `project_clone` (pattern: `test_run` in `src/lib/test-runner.ts`).
- Hidden in demo / playground (`playgroundForbidden()`).

## Scope
- [ ] Pure `isCloneUrl(url)` + `cloneDest(parent, url)` in `src/lib/hub.ts` (+ check)
- [ ] `src/lib/git-clone.ts` spawn + cancel; `POST /api/projects/clone`, `/clone/cancel`
- [ ] Dialog tab "Clone from git" in `AddProjectDialog`; on success add + open the project
- [ ] i18n strings

**Out of scope:** auth prompts (uses the user's git credentials as is), private-key setup.

## Files
- `src/lib/hub.ts` (+ check), `src/lib/git-clone.ts` — new
- `src/app/api/projects/clone/route.ts`, `src/app/api/projects/clone/cancel/route.ts` — new
- `src/components/projects/AddProjectDialog.tsx`
- `e2e/projects-hub.mjs` — clone a bare repo made in the fixture (see notes)

## Implementation notes
- For e2e, allow `file://` only when `VIBEDOC_E2E=1`, then clone a bare repo made in the fixture.

## Acceptance criteria
- [ ] Clone of a valid URL into an empty parent → project opens, listed in the hub
- [ ] `--upload-pack=…` or `ext::` URL → refused before git runs
- [ ] A failing clone (unknown repo) shows git's error line, nothing added, no half folder left
- [ ] Not offered in the demo or playground

## Manual tests
- [ ] S2 — WHEN the user pastes a git URL and picks a folder → THEN the repo is cloned there and opens in the hub, or the clone error is shown in words

## Verify
```bash
node src/lib/hub.check.mts
pnpm lint && pnpm build
VIBEDOC_E2E=1 BASE=http://localhost:3081 node e2e/projects-hub.mjs
```
