# T167: Kit counts assertions per step; steps without a real one are unverified
**Status:** ✅ Done
**Phase:** R063 — Honest tests
**Size:** M (2–3 hrs)
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
Every recorded step knows how many assertions it made and how many of those looked at the page. A step with none, or only trivial ones (`expect(true).toBe(true)`), shows as **unverified** in the evidence doc.

## Context
- Epic: `plans/roadmap/R063-honest-tests.md`
- Interview decisions:
  - **Signals** are runtime only. No static parsing: `typescript` is a devDependency, so it is missing from npm installs.
  - **Effect:** "unverified" never counts as proven (T169) and shows as a badge (T170).
- Specs import `{ test, expect }` from the test kit (`<testDir>/vibedoc/kit/testing/playwright-fixture.ts`, a copy of `src/testing/playwright-fixture.ts` written by `ensureFixtureKit` in core, R061). The fixture re-exports Playwright's `expect` today.
- `RunStep` / `RunManifest` live in `src/lib/runs-paths.ts` ("Keep the shape stable"). Add optional fields only; old run.json files must still parse.
- `matchItems` / `formatEvidence` are in `src/lib/evidence.ts` (pure, R060). The kit copies `evidence.ts`, so it can't import other libs by value.
- Pure libs never import values from each other (`node *.check.mts` runs without a bundler).

## Scope
- [ ] Fixture: export a wrapped `expect`.
  - Each call `expect(subject)` (and `expect.soft`) inside a running `step()` adds 1 to that step's `total`.
  - It also adds 1 to `onPage` when the subject is a Playwright `Locator`, `Page`, `APIResponse`, or `expect.poll`'s function. A literal (boolean, number, string, plain object) counts as trivial.
  - `.not`, matchers and `expect.configure` keep working. Re-export all of `expect`'s static members.
- [ ] Record `assertions: { total, onPage }` on each step in run.json.
- [ ] New pure `src/lib/honesty.ts`:
  - `stepVerdict(step, blankPassed?: boolean)` returns the reasons, or `[]` for verified: `"no assertion"`, `"only trivial assertions"`, and (T168) `"passes without the app"`.
  - Steps without an `assertions` field (older runs, a spec not on the kit) → `[]`. Unknown is not flagged.
  - Self-check in `honesty.check.mts`.
- [ ] `evidence.ts`: `matchItems` rows carry `unverified: string[]`. `formatEvidence` writes `⚠️ unverified: no assertion` under such an item (after its screenshot line) and counts them in the summary line (`… · 1 unverified`). `evidence.ts` gets the verdict via an injected function or a field already computed on the step, never by importing `honesty.ts` by value.
- [ ] `ensureFixtureKit`: stamp `VERSION` with VibeDoc's version plus a short hash of the kit sources, so a changed fixture rewrites the kit in dev too (today it only rewrites on a version change).

**Out of scope:** the blank-page check (T168), what unverified does to ticks and badges (T169), UI badges (T170).

## Files
- `src/testing/playwright-fixture.ts`: expect wrapper; current step tracking.
- `src/lib/runs-paths.ts`: optional `assertions` on `RunStep`.
- `src/lib/honesty.ts` + `src/lib/honesty.check.mts`: new.
- `src/lib/evidence.ts` + `src/lib/evidence.check.mts`
- `src/lib/core.ts`: `ensureFixtureKit` stamp; the kit file list gains `lib/honesty.ts` if the fixture uses it.

## Implementation notes
- Detect a Locator / Page without importing Playwright classes:
  - Locator: `typeof s?.waitFor === 'function' && typeof s?.locator === 'function'`
  - Page: `typeof s?.goto === 'function'`
  - APIResponse: `typeof s?.status === 'function' && typeof s?.headers === 'function'`
- Track the current step in a variable set and reset inside the `step()` wrapper. Steps run one at a time per worker.
- `expect` is callable with properties (`expect.soft`, `expect.poll`, `expect.extend`, `expect.configure`). A `Proxy` with an `apply` trap that forwards `get` keeps them all.

## Acceptance criteria
- [ ] A kit spec with an honest step (`expect(page.getByRole('heading')).toHaveText(…)`), a step with no expect, and a step with `expect(true).toBe(true)` → run.json has `assertions` `{1,1}`, `{0,0}`, `{1,0}`. EVIDENCE.md marks the last two `⚠️ unverified` with their reasons.
- [ ] `e2e/vibedoc/T155-*.spec.ts` still passes, with all 5 steps verified.
- [ ] Old run.json files (no `assertions`) still render with no unverified marks.
- [ ] `node src/lib/honesty.check.mts` and `node src/lib/evidence.check.mts` print ok, and `pnpm build:playwright` compiles.

## Verify
```bash
node src/lib/honesty.check.mts && node src/lib/evidence.check.mts
pnpm build:playwright && pnpm lint && pnpm build
npx playwright test e2e/vibedoc/T155-evidence-tab-in-test-review.spec.ts
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Write a kit spec (in e2e/vibedoc/) with one honest step (`expect(page.getByRole(...)).toHaveText(...)`), one step with no expect and one with only `expect(true).toBe(true)`, run it with `npx playwright test` → its run.json steps have `assertions` {1,1}, {0,0} and {1,0} (agent checked with a throwaway spec, since removed)
- [ ] Open that task's EVIDENCE.md → the summary reads "… · 2 unverified", and the two weak steps show `⚠️ unverified: no assertion` / `only trivial assertions` under their screenshot
- [ ] `expect.poll(...)` and `expect(locator).not.toBeVisible()` count as checks on the page (not flagged)
- [ ] Change src/testing/playwright-fixture.ts and call `vibedoc_get_frontend` → e2e/vibedoc/kit is rewritten and its VERSION reads `<version>+<hash>`
### Regression risk
- [ ] T155's spec still passes through the kit and its evidence shows no unverified steps; older runs without counts show no flags
- [ ] `npm pack --dry-run` lists src/lib/honesty.ts and dist/lib/honesty.js
