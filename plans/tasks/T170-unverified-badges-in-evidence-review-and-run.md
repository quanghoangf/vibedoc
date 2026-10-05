# T170: Unverified badges in Evidence, review and the Run strip
**Status:** ✅ Done
**Phase:** R063 — Honest tests
**Size:** M (2–3 hrs)
**Depends on:** T169
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05
**Done:** 2026-10-05

## Goal
A reviewer sees at a glance which steps aren't really proven, and why. A Send back takes them along automatically.

## Context
- Epic: `plans/roadmap/R063-honest-tests.md`
- UI pieces:
  - `src/components/manual-tests/TestEvidence.tsx`: `ReviewDesk` (Steps to review, Doubt, marks), from R062;
  - `TestDetail.tsx`: the Automated checklist items, live ticks;
  - `RunLive.tsx`: the Run strip, R061.
- The evidence API rows carry `unverified: string[]` (T167/T168). The run state has a `checking` phase and `blankPassed` (T168).
- Marks: `ReviewMark { kind: "doubt" | "failed" }` in `src/lib/review.ts`. Add `"unverified"` with its own glyph and keep old entries parsing. The API validation in `src/app/api/tasks/review/route.ts` takes the new kind.
- Visual language: DESIGN.md "Manual Test Report (signature)". Doubt is Burner Amber; unverified needs a distinct, quieter treatment (a dashed amber outline chip "unverified", with the reason in its title and as small text under the step).

## Scope
- [ ] Steps to review: an unverified step shows the chip and its reason. It's included in Send back as a `kind: "unverified"` mark with the reason as its comment. The reviewer can't remove it, the same as failed. The count line gains "N unverified".
- [ ] Review view: an Automated item that isn't proven because it's unverified shows the chip instead of the Bot icon.
- [ ] Run strip: after the steps pass, show "Checking the test is honest…" during `checking`. The verdict line then reads "Passed · 5/5 steps · 1 unverified" when there are any, and steps passing on the blank page get the chip.
- [ ] DESIGN.md: the unverified chip in the signature section.

**Out of scope:** board card changes beyond what T169's badge colour already gives.

## Files
- `src/components/manual-tests/TestEvidence.tsx`, `TestDetail.tsx`, `RunLive.tsx`
- `src/lib/review.ts` (+ check), `src/app/api/tasks/review/route.ts`: the `unverified` mark kind
- `DESIGN.md`

## Acceptance criteria
- [ ] A review task whose run has a trivial step → Steps to review shows "unverified: only trivial assertions". Send back lists it, and the `## Review` entry has a `Step N … — unverified: …` line.
- [ ] Run a spec with a setContent-only step → the strip shows "Checking the test is honest…", then the chip on that step.
- [ ] An honest run shows no chips and no checking delay message after it ends.
- [ ] Lint stays at the baseline, and `node src/lib/review.check.mts` passes.

## Verify
```bash
node src/lib/review.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] Give a task a kit spec with a setContent-only step, an honest step and an `expect(true)` step (all 🤖) and press Run tests on /manual-tests → the strip shows "Checking the test is honest…", then "Passed · 3/3 steps · 2 unverified" with an "unverified" chip on the setContent step (agent checked with a throwaway spec, since removed)
- [ ] The Review view's Automated header reads "· 2 unverified, check by hand" and the two unproven items carry the dashed "unverified" chip
- [ ] Move it to review and open Evidence → the bar says "2 unverified", Steps to review shows the chip, a help icon and the reason under those steps, and they have no Doubt button
- [ ] Send back… → both are listed (with reasons); sending writes `- ❔ Step N "…" — unverified: <reason> · screenshot …` lines into ## Review
### Regression risk
- [ ] An honest run shows no chips; Doubt on passed steps and failed-step flags work as before
- [ ] The board card for a send back with unverified marks counts them with the flagged steps
