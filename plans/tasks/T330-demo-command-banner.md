# T330: `vibedoc --demo` opens a throwaway sample project with a Demo banner
**Status:** 👀 Review
**Phase:** R085 — Demo playground
**Size:** L (half a day)
**Depends on:** —
**Covers:** S1, S3
**Owner:** ai:claude-code
**Started:** 2026-10-07

## Goal
One command, `vibedoc --demo`, copies the sample project to a temporary folder, starts VibeDoc on it and opens the board. Every page shows a "Demo" banner whose "Use VibeDoc on my project" button gives the command for the user's own repo. Closing the CLI removes the copy.

## Context
- Epic: `plans/roadmap/R085-demo-playground.md`
- The sample project already exists: `examples/demo-project` ("Listly"), used by R042's hosted read-only demo (`VIBEDOC_DEMO=1`, `Dockerfile`, `pnpm demo`). Reuse it. Don't fork a second sample.
- Decision: the local demo is a **new mode**, `VIBEDOC_PLAYGROUND=1`. It is writable (people can move cards and edit docs in the copy). R042's `VIBEDOC_DEMO=1` stays read-only and unchanged. `src/lib/demo.ts` gets `isPlayground()` next to `isDemo()`.
- Decision: the copy lives at `<os.tmpdir()>/vibedoc-demo-XXXXXX/listly` (`mkdtemp`). The folder must be named `listly` so `projectKey()` (`src/lib/runs-paths.ts`) and the header read "listly". Test runs go to `<tmp>/.runs` via `VIBEDOC_RUNS_DIR`, so `~/.vibedoc/runs` is never touched. Hidden name, so `discoverProjects()` never lists it.
- `examples/` is not in package.json `files` yet, so `npx vibedoc --demo` would find nothing. Add `examples/demo-project/`.
- The CLI (`bin/vibedoc.mjs`) runs `next start`. The browser opens on `/setup` today; the demo opens on `/board`.
- R080 (another epic) is rewriting startup (stable port, ready-wait, printed URLs). Keep the demo change small and in its own module (`bin/demo.mjs`) so it merges cleanly: the CLI only needs `prepareDemo()` → `{ root, runsDir, cleanup }`, plus the env vars and the start path.
- CLAUDE.md: "No hardcoded UI text in components: add it to `src/i18n/<area>.ts` (`en` + typed `vi`)" and "Never use `localStorage`".

## Scope
- [ ] `bin/demo.mjs`: `prepareDemo()` copies `examples/demo-project` (relative to the package, not the cwd) to `<mkdtemp>/listly` with `fs.cpSync(…, { recursive: true })` and returns `{ root, runsDir, cleanup }`; `cleanup()` does `rmSync(tmp, { recursive: true, force: true })`
- [ ] `bin/vibedoc.mjs`: `--demo` → `prepareDemo()`, start Next with `VIBEDOC_ROOT=<root>`, `VIBEDOC_PLAYGROUND=1`, `VIBEDOC_RUNS_DIR=<runsDir>` (ignore any `VIBEDOC_ROOT` from the env), open `/board`, and call `cleanup()` on SIGINT, SIGTERM and server exit
- [ ] `src/lib/demo.ts`: `isPlayground()`; `rootFrom()` and `discoverProjects()` in core.ts lock to the configured root in playground mode too (same as `isDemo()`), so `?root=` can't reach the user's files
- [ ] `/api/summary` returns `playground: isPlayground()`; `AppContext` exposes `playground` (follow how `demo` flows from `/api/summary`)
- [ ] `DemoBanner` component under the header on every `(app)` page in playground mode: "Demo: a sample project in a temporary copy. Nothing you change here is saved." + button "Use VibeDoc on my project"
- [ ] The button opens a small dialog: `cd your-project` + `npx vibedoc` with a copy button, one line that the demo copy is deleted when they stop this command
- [ ] Banner/dialog text in `src/i18n/shell.ts` (en + vi)
- [ ] package.json `files`: add `examples/demo-project/`
- [ ] `bin/demo.check.mts`: `prepareDemo()` makes a copy with `plans/roadmap`, the folder is named `listly`, `cleanup()` removes the temp dir, and the source `examples/demo-project` is unchanged

**Out of scope:** blocking agent chat / test runs and the sweep of leftover demo folders (T331); more sample data (T332); the sample evidence run (T333); site and welcome links (T334); R080's startup rework.

## Files
- `bin/demo.mjs` — new; `prepareDemo()`
- `bin/demo.check.mts` — new; self-check (pattern: `bin/vibedoc.check.mts`)
- `bin/vibedoc.mjs` — `--demo` flag, env, start path, cleanup
- `src/lib/demo.ts` — `isPlayground()`
- `src/lib/core.ts` — `rootFrom()` (line ~179) and `discoverProjects()` (~371): treat playground like demo for the root lock
- `src/app/api/summary/route.ts` — `playground` field
- `src/context/AppContext.tsx`, `src/types/index.ts` — `playground` flag
- `src/components/layout/DemoBanner.tsx` — new
- `src/app/(app)/layout.tsx` — render the banner
- `src/i18n/shell.ts` — banner + dialog text
- `package.json` — `files`

## Implementation notes
- `examples/demo-project` is found with `path.resolve(__dirname, '..', 'examples', 'demo-project')` in the bin, the same way `projectRoot` is found.
- Use an existing dialog component from `src/components/ui/` for the "Use on my project" dialog; the copy button can follow any existing copy-to-clipboard button (grep `clipboard.writeText`).
- `process.on('exit')` can only run sync code: use `rmSync`, not the promise API.

## Acceptance criteria
- [ ] `pnpm build && node bin/vibedoc.mjs --demo --port 3085` opens `/board` showing Listly's tasks and the Demo banner
- [ ] Ctrl+C removes the temp folder; `git status examples/` is clean
- [ ] `/api/projects` lists only the demo copy; `/api/tasks?root=<another path>` still reads the demo copy
- [ ] "Use VibeDoc on my project" shows `npx vibedoc` and copies it
- [ ] Without `--demo` nothing changes: no banner, `/setup` opens, `?root=` still works
- [ ] `node bin/demo.check.mts` and `node bin/vibedoc.check.mts` pass; `node src/lib/i18n.check.mts` passes

## Manual tests
_2026-10-07 — ai · Spec: `e2e/vibedoc/T330-demo-command-banner.spec.ts` · Auto: passed 2026-10-07_
### Steps
- [ ] S1 — WHEN the user runs `vibedoc --demo` → THEN the browser opens a populated sample project with a Demo banner
- [ ] S3 — WHEN the user clicks "Use VibeDoc on my project" → THEN they get the command for their own repo
- [x] 🤖 Open /board in the demo → the Listly board shows with a "Demo" badge in the header
- [x] 🤖 Click "Use VibeDoc on my project" → a dialog shows `cd your-project` and `npx vibedoc` with copy buttons
- [x] 🤖 The project switcher lists only "listly"
- [ ] `pnpm build && node bin/vibedoc.mjs --demo` → the terminal says it's a temporary copy, the browser opens on /board
- [ ] Click a copy button in the dialog, paste somewhere → the command was copied
- [ ] Press Ctrl+C in the terminal → the temp folder printed at start is gone; `git status examples/` is clean
### Regression risk
- [ ] `node bin/vibedoc.mjs` (no `--demo`) in a project → no banner, the browser opens /setup, the project switcher lists sibling projects

## Verify
```bash
node bin/demo.check.mts && node bin/vibedoc.check.mts && node src/lib/i18n.check.mts
pnpm lint && pnpm build
node bin/vibedoc.mjs --demo --port 3085   # look at /board, click the banner button, Ctrl+C, then: git status examples/
```
