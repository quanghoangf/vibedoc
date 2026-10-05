# T158: Fixture kit in the target repo + /work-epic specs use it
**Status:** 📋 Todo
**Phase:** R061 — Run tests from VibeDoc
**Size:** M (2–3 hrs)
**Depends on:** T157

## Goal
Every spec an agent writes records step screenshots, video and evidence, so a Run from VibeDoc shows proof and not just pass/fail. Today `/work-epic` writes plain `@playwright/test` specs, which record nothing.

## Context
- Epic: `plans/roadmap/R061-run-tests-from-vibedoc.md`
- Interview decision: the fixture is **copied into the target repo** at `<testDir>/vibedoc/kit/` and committed with the specs. Specs import it relatively. This means:
  - the fixture uses the repo's own `@playwright/test`, so there is never a second Playwright instance;
  - the spec also runs outside VibeDoc and in CI;
  - the target does not install the `vibedoc` package.
- The fixture is `src/testing/playwright-fixture.ts`. It imports `../lib/runs-paths.js`, `runs-retention.js`, `manual-tests.js` and `evidence.js`, all pure with only node built-ins. The kit is those 5 files, keeping the same relative layout.
- `testDir` comes from the app's `playwright.config.*` (relative to the config), else `e2e`, inside the app Dir. This is the same rule `/work-epic` uses for spec paths (`skills/work-epic/SKILL.md` step 3). `~/.claude/skills/work-epic` is a symlink to `skills/work-epic` in this repo.
- CLAUDE.md lists every file VibeDoc writes into a project. Add the kit there, and only write it when needed (on Run, or via MCP for the agent).

## Scope
- [ ] `core.ts`:
  - `ensureFixtureKit(root, app)` writes `<appDir>/<testDir>/vibedoc/kit/` (`testing/playwright-fixture.ts` + `lib/*.ts` + a `VERSION` file with VibeDoc's package version).
  - It rewrites the kit only when `VERSION` differs or a file is missing. It never touches anything else in `<testDir>/vibedoc/`.
  - Returns the import path for specs, e.g. `./kit/testing/playwright-fixture`.
- [ ] **Spike first:** check that Playwright resolves the kit's `.js` import specifiers to the copied `.ts` files. If it does not, copy the compiled `dist/` files plus a `package.json` with `{"type":"commonjs"}` in the kit instead, and note which in the code.
- [ ] Call `ensureFixtureKit` in `POST /api/tasks/run` (T157) before spawning.
- [ ] Expose it to agents: add a `**Test kit:**` line with the import path to `vibedoc_get_frontend`, and make that call ensure the kit exists when Playwright is installed.
- [ ] `skills/work-epic/SKILL.md` "Write the spec":
  - import `{ test, expect } from './kit/testing/playwright-fixture'`;
  - use `test.use({ vibedocTask: '<id>' })`;
  - write one `await step('<item text>', async () => …)` per automated item instead of `test.step`.
  - Update the example spec. Keep every spec rule (role locators, no sleeps, `expect` per step, never weaken).
- [ ] Update the fixture's header comment and README / `docs/getting-started.md` ("import `vibedoc/playwright`" → the kit path; the package export stays for people who install it).

**Out of scope:** migrating existing specs (only `e2e/vibedoc/T155-*.spec.ts` here, which can switch to the kit as the proof); the Run UI (T159).

## Files
- `src/lib/core.ts`: `ensureFixtureKit`. Find `testDir` with a small pure helper (`playwrightTestDir(configText)` in `src/lib/frontend.ts`, with a check case).
- `src/app/api/tasks/run/route.ts`, `src/app/api/mcp/route.ts` (`vibedoc_get_frontend` output).
- `skills/work-epic/SKILL.md`, `README.md`, `docs/getting-started.md`, `CLAUDE.md` (what VibeDoc writes).

## Implementation notes
- Read the kit sources from VibeDoc's install dir (`src/testing`, `src/lib`), else from `dist/` when installed from npm. Same resolution as T157's reporter path.
- A `.gitignore` is not needed: the kit is meant to be committed with the specs.

## Acceptance criteria
- [ ] In a scratch app with Playwright, `vibedoc_get_frontend` creates `e2e/vibedoc/kit/` and prints its import path. A spec importing it runs with `npx playwright test` and leaves run.json, screenshots, video and EVIDENCE.md.
- [ ] Running it twice does not rewrite the kit (mtime unchanged). Bumping `VERSION` by hand → the next ensure rewrites it.
- [ ] `/work-epic`'s spec section and example use the kit and `step()`.
- [ ] `node src/lib/frontend.check.mts` passes with the new `playwrightTestDir` cases.

## Verify
```bash
node src/lib/frontend.check.mts
pnpm lint && pnpm build
<scratchpad>/mcp.sh vibedoc_get_frontend '{}' | grep 'Test kit'
npx playwright test e2e/vibedoc/T155-evidence-tab-in-test-review.spec.ts
```
