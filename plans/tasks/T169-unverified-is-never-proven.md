# T169: Unverified is never proven: ticks, the Auto header, Needs you
**Status:** 📋 Todo
**Phase:** R063 — Honest tests
**Size:** M (2–3 hrs)
**Depends on:** T168

## Goal
A task can't show as automatically verified while a step is unverified. Its automated item stays unticked, the checklist header reads `Auto: passed · N unverified`, the task stays under Needs you, and the badge isn't green.

## Context
- Epic: `plans/roadmap/R063-honest-tests.md`. Done when: a spec with an empty or trivial assertion is flagged before the task can show as automatically verified.
- Where "proven" is decided today:
  - `ticksForRun` (`src/lib/evidence.ts`, T160);
  - `untestedItems` + the header `Auto:` in `src/lib/manual-tests.ts`;
  - `toRow` / `needsYou` / `countNeedsYou` in `src/lib/test-review.ts`;
  - the card 🧪 badge (`TaskCard.tsx`: teal when `untested === 0`).
- Verdicts come from `stepVerdict` (T167/T168) over the newest run's steps plus `honesty.json`.
- Interview decision: an agent's `vibedoc_update_task { autoResult: "passed" }` also counts unverified steps from the newest run (assertion counts only; agents don't run the blank check).

## Scope
- [ ] `ticksForRun(items, steps)`: a passed step that is unverified isn't ticked. Steps carry their verdict.
- [ ] Header: `AutoRun` gains an optional `unverified: number`, written as `· Auto: passed 2026-10-12 · 2 unverified` and parsed back. Old headers parse as 0. `recordRunResult` (T160) writes it.
- [ ] `untestedItems`: an unverified 🤖 item counts as left even when `Auto: passed`. That feeds `untested` → Needs you / the sidebar / the card badge (not teal). The `/manual-tests` row and `outstanding()` say "N unverified".
- [ ] MCP `vibedoc_update_task` with `autoResult: "passed"`: compute unverified from the newest kept run's steps (assertions only) and write it into the header. Append `⚠️ N steps unverified: <names>` to the reply so the agent fixes the spec.

**Out of scope:** UI badges in Evidence / Run strip (T170), skill text (T171).

## Files
- `src/lib/evidence.ts`, `src/lib/manual-tests.ts`, `src/lib/test-review.ts` (+ their `.check.mts`)
- `src/lib/core.ts`: `recordRunResult`, `saveManualTests` path for `autoRun`
- `src/app/api/mcp/route.ts`: the `vibedoc_update_task` reply

## Acceptance criteria
- [ ] Run a kit spec with one trivial step from VibeDoc → that 🤖 item stays `[ ]`, the header ends `· 1 unverified`, and the task shows under Needs you with a non-teal badge.
- [ ] An honest spec → the header has no `unverified` part and the items tick as before.
- [ ] An agent's `vibedoc_update_task autoResult: passed` on a task whose newest run has a no-assert step → the reply lists it and the header counts it.
- [ ] Every self-check passes. Old task files parse unchanged.

## Verify
```bash
node src/lib/evidence.check.mts && node src/lib/manual-tests.check.mts && node src/lib/test-review.check.mts
pnpm lint && pnpm build
```
