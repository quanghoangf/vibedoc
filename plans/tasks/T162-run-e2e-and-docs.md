# T162: e2e for Run from VibeDoc + docs
**Status:** 📋 Todo
**Phase:** R061 — Run tests from VibeDoc
**Size:** M (2–3 hrs)
**Depends on:** T160, T161

## Goal
Prove the epic end to end: clicking Run replays the spec, the checklist ticks live, and the evidence doc updates. The docs say how it works.

## Context
- Epic: `plans/roadmap/R061-run-tests-from-vibedoc.md`. Done when: clicking Run on a task replays its spec, the checklist ticks live, and the evidence doc updates.
- e2e harness:
  - `e2e/stub-chat.mjs` provides `makeFixture`, `launchChrome` and `stubChat` with `root`.
  - `e2e/evidence.mjs` (R060) shows how runs land in `~/.vibedoc/runs/<projectKey>` and are cleaned up in `finally`.

## Scope
- [ ] `e2e/run-tests.mjs`:
  - **Fixture project:** a tiny static frontend (a `package.json` with `@playwright/test` resolvable, a `playwright.config` with a `webServer` or a plain `npx serve` start command) plus a task with a spec using the kit (T158). Two 🤖 items and one manual item.
  - **Run:** open `/manual-tests?task=…` and click Run. The steps go running → passed, the two Automated items tick before the run ends (poll during the run), and the task file ends with `Auto: passed` and the items `[x]`.
  - **Evidence:** the Evidence view lists the new run as newest.
  - **Stop:** a second Run, then Stop → cancelled, and the file is unchanged.
  - **Cleanup:** remove the runs dir and the fixture.
  - If a self-contained frontend is too heavy, run the fixture against VibeDoc's own server with a spec that opens a static VibeDoc page, and say so in the header comment.
- [ ] Docs:
  - CLAUDE.md: the API list gets `tasks/run`, and the written-files list gets the kit (if T158 missed it).
  - MEMORY.md conventions: runner, reporter, one run per project, the kit, and which result gets persisted.
  - README "Browser tests" section: Run from VibeDoc.
  - DESIGN.md: if T159 / T161 missed anything.
- [ ] Set R061 to done once the Done when holds.

**Out of scope:** CI.

## Files
- `e2e/run-tests.mjs`: new.
- `CLAUDE.md`, `memory/MEMORY.md`, `README.md`, `DESIGN.md`

## Acceptance criteria
- [ ] `node e2e/run-tests.mjs` passes and leaves no playwright process or runs dir behind.
- [ ] `node e2e/evidence.mjs` still passes.

## Verify
```bash
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/run-tests.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/evidence.mjs
```
