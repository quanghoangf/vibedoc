# T333: A sample test run with a playable evidence video
**Status:** 📋 Todo
**Phase:** R085 — Demo playground
**Size:** L (half a day)
**Depends on:** T330
**Covers:** S1

## Goal
In the demo, a done task has a recorded test run: the evidence view shows its steps, screenshots and a video that plays, without the user running anything.

## Context
- Epic: `plans/roadmap/R085-demo-playground.md` — "Done when … a playable evidence video".
- Runs live outside the project: `<runsRoot>/<projectKey>/<taskId>/<runId>/` with `run.json` (`RunManifest` in `src/lib/runs-paths.ts`), step PNGs and a `.webm`. T330 points `VIBEDOC_RUNS_DIR` at `<tmp>/.runs` and names the copy `listly`, so the demo's runs go in `<tmp>/.runs/listly/<taskId>/<runId>/`.
- Listly is fictional: there is no app to test. Decision: a tiny static "Listly" page (one HTML file: a shared list, add item, share link) recorded once by a generator script; the output is committed so the demo needs no Playwright at runtime.
- Evidence is derived on read (`getEvidence()` in core.ts, `src/lib/evidence.ts`): the run's step names must match the task's 🤖 `## Manual tests` items for the checklist to show "passed". The task file also needs the `Auto: passed <date>` header the runner writes (`recordRunResult`), see `src/lib/manual-tests.ts`.
- Size matters: this ships in the npm package (`files`). Keep the run under ~1.5 MB (short video, small viewport).

## Scope
- [ ] `examples/demo-runs/listly-app/index.html` — static Listly mock (no build, no deps)
- [ ] `scripts/demo-run.mjs` — records one run against that page with Playwright (prefer the kit fixture so run.json / presentation chapters are real; fall back to `recordVideo` + a hand-written run.json in the `RunManifest` shape) and writes it to `examples/demo-runs/listly/<taskId>/<runId>/`. Run by a maintainer, not at install
- [ ] Commit the output for one done task with 3–4 steps (e.g. T004 share by link) and that task's matching 🤖 manual tests + `Auto: passed` header in `examples/demo-project`
- [ ] `prepareDemo()` copies `examples/demo-runs/listly` to `<tmp>/.runs/listly`; package.json `files` gets `examples/demo-runs/listly/` (not the generator's page if not needed at runtime)
- [ ] The card 🧪 badge and `/manual-tests?task=T004&view=evidence` show the run; the video plays in `RunPlayer` with step captions

**Out of scope:** running tests from the demo (blocked by T331); a failing / flaky sample run (one passing run proves the point; add later if wanted).

## Files
- `examples/demo-runs/listly-app/index.html` — new
- `scripts/demo-run.mjs` — new generator
- `examples/demo-runs/listly/T004/<runId>/` — generated, committed (`run.json`, PNGs, `.webm`)
- `examples/demo-project/plans/tasks/T004-share-list-by-link.md` — manual tests + Auto header
- `bin/demo.mjs` — copy the runs; `bin/demo.check.mts` — the runs copy exists after `prepareDemo()`
- `package.json` — `files`

## Implementation notes
- How the kit records: `src/testing/playwright-fixture.ts` (`step()`, presentation mode via `src/lib/presentation.ts`), env `VIBEDOC_RUNS_DIR` / project key decide where it writes. Running it from the generator with `VIBEDOC_RUNS_DIR=examples/demo-runs` and a project named `listly` may give the right layout for free.
- Media are served by the runs API, which validates names with `isRunId` / `isRunFile`: keep the generated names in that shape.

## Acceptance criteria
- [ ] In `vibedoc --demo`, T004's evidence view shows n/n steps passed with screenshots, and the video plays (seek works: the runs API serves `Range`)
- [ ] `examples/demo-runs/listly` is ≤ 1.5 MB (`du -sh`)
- [ ] Nothing is written to `~/.vibedoc/runs` by the demo
- [ ] `node scripts/demo-run.mjs` regenerates the run from scratch
- [ ] `node bin/demo.check.mts`, `pnpm build` pass

## Manual tests
- [ ] S1 — WHEN the user runs `vibedoc --demo` → THEN the browser opens a populated sample project with a Demo banner

## Verify
```bash
node bin/demo.check.mts && du -sh examples/demo-runs/listly
pnpm build && node bin/vibedoc.mjs --demo --port 3085   # /manual-tests?task=T004&view=evidence, play the video
```
