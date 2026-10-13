# T527: Toolkit Done-when end to end, docs, close R098
**Status:** 👀 Review
**Phase:** R098 — Agent toolkit setup
**Size:** S
**Depends on:** T526
**Covers:** S1, S2, S3, S4, S5
**Owner:** ai:claude-code
**Due:** 2026-10-14
**Started:** 2026-10-13

## Goal
Prove the epic's Done-when on a fresh project, document the toolkit step, and close R098.

## Context
- Epic: `plans/roadmap/R098-agent-toolkit-setup.md`. Done when: "on a fresh project, a user picks 3 plugins on the welcome, confirms once, and sees 3 ✓ without leaving VibeDoc".
- Each earlier task carries its own tests. This task only runs the cross-task flow and does the docs.
- The `agent-toolkit` spec is new; the human merges the epic's `## Spec changes` ("Merge into spec") once it's done. Don't edit `docs/specs/` here.

## Scope
- [ ] e2e in `e2e/toolkit.mjs`: a fresh fixture project → welcome → Connect (stub) → pick 3 → one confirm → 3 ✓, no navigation away
- [ ] One real run against a real Claude Code on a scratch project (not the stub); note the version and any id fixes in the catalog
- [ ] `docs/getting-started.md`: the "Pick your toolkit" step and asking the agent; a list of the catalog with reasons
- [ ] README onboarding section: one line pointing at the step
- [ ] Mark R098 done

**Out of scope:** new catalog items, a Settings page.

## Files
- `e2e/toolkit.mjs`, `docs/getting-started.md`, `README.md`
- `src/lib/toolkit-catalog.ts` (only if the real run finds a wrong id)

## Acceptance criteria
- [ ] The Done-when e2e passes
- [ ] A real install of 3 catalog plugins works on Claude Code (version noted)
- [ ] `vibedoc_check_docs` clean for the changed docs

## Verify
```bash
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH PORT=3081 pnpm dev:next &
BASE=http://localhost:3081 node e2e/toolkit.mjs
```

## Manual tests
_2026-10-13 — ai_
### Steps
- [ ] Open docs/getting-started.md → section 3 has "Pick your toolkit" with the plugin table, and it matches what /start shows
- [ ] Open the README Quick start → one line points at Pick your toolkit
- [ ] On a brand-new folder, run `npx vibedoc` → the welcome opens, Pick your toolkit lists plugins that fit, tick 3 → Install selected → Install → all 3 turn Installed without leaving the page
### Regression risk
- [ ] The README and getting-started links to Settings → Connect agent still work
