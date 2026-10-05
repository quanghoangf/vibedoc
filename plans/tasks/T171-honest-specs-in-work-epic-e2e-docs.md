# T171: Honest specs in /work-epic, e2e and docs
**Status:** 📋 Todo
**Phase:** R063 — Honest tests
**Size:** M (2–3 hrs)
**Depends on:** T170

## Goal
Agents write specs that pass the honesty checks the first time, and an end-to-end test proves that a dishonest spec gets flagged before it can count as verified.

## Context
- Epic: `plans/roadmap/R063-honest-tests.md`. Done when: a spec with an empty or trivial assertion is flagged before the task can show as automatically verified.
- `skills/work-epic/SKILL.md` "Write the spec" / "Run the spec" (R058, R061). `~/.claude/skills/work-epic` is a symlink to it.
- e2e harness: `e2e/run-tests.mjs` (R061) has a fixture project pointed at VibeDoc's server, with node_modules linked. Copy its setup.

## Scope
- [ ] Skill:
  - "Every step ends with an `expect` **on the page** (a locator, the page or a response); an `expect` on a literal counts as none."
  - "If `vibedoc_update_task` reports unverified steps, fix those steps before done (never by adding a trivial expect)." Add it to the never-weaken list.
- [ ] `e2e/honest-tests.mjs`: a fixture task with three 🤖 items and a kit spec:
  - (1) honest;
  - (2) no expect;
  - (3) `expect(true).toBe(true)`.

  Run it from /manual-tests. Expected:
  - item 1 ticks;
  - items 2 and 3 stay `[ ]` with the unverified chips;
  - the header has `· 2 unverified`;
  - the task is under Needs you;
  - Send back from Evidence lists both as unverified marks.

  Clean up in `finally`.
- [ ] Docs:
  - README "Screenshots and video" / Run section: one paragraph on honesty checks;
  - `docs/getting-started.md`: the same;
  - MEMORY.md conventions;
  - `docs/architecture/mcp-tools.md` for the `vibedoc_update_task` reply.
- [ ] Set R063 to done once the Done when holds.

**Out of scope:** CI.

## Files
- `skills/work-epic/SKILL.md`, `e2e/honest-tests.mjs` (new)
- `README.md`, `docs/getting-started.md`, `memory/MEMORY.md`, `docs/architecture/mcp-tools.md`

## Acceptance criteria
- [ ] `node e2e/honest-tests.mjs` passes and leaves no runs or fixture behind.
- [ ] `node e2e/run-tests.mjs` and `node e2e/evidence.mjs` still pass.

## Verify
```bash
pnpm lint && pnpm build
PW_DIR=<dir with node_modules/playwright> node e2e/honest-tests.mjs
PW_DIR=<dir with node_modules/playwright> node e2e/run-tests.mjs
```
