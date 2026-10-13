# T528: Toolkit step, confirm dialog and chat card polished with /impeccable
**Status:** 📋 Ready
**Phase:** R098 — Agent toolkit setup
**Size:** M
**Depends on:** T526

## Goal
The toolkit UI (welcome step, confirm dialog, per-item results, chat card) reads as one calm system with the Connect panel above it: clear ranking, scannable reasons, and states (installed / installing / ✓ / error) that can be told apart at a glance. The behaviour does not change.

## Context
- Epic: `plans/roadmap/R098-agent-toolkit-setup.md`
- Surfaces built in T525 and T526: `src/components/toolkit/ToolkitPicker.tsx`, `ToolkitConfirmDialog.tsx`, `src/components/welcome/ToolkitStep.tsx`, `src/components/chat/ToolkitCard.tsx`.
- Project pattern (T506, T507, T509, T511): run `/impeccable` **before** changing markup, then apply its direction and record its decisions in a `## Design decisions (/impeccable)` section of this task. Design tokens and Do/Don't: `DESIGN.md`, `PRODUCT.md`. Critique snapshots are saved under `.impeccable/critique/`.
- Points to judge in particular:
  - The "best fit" signal: how a matched item shows *why* it is first without a badge on every row
  - The density of 8 rows with reasons on the welcome versus in a narrow chat card
  - The difference between installed (disabled) and unticked
  - Error rows: the real stderr is long, so it needs a readable layout with the copy command near it
  - The confirm dialog listing commands without looking alarming
  - Light and dark themes, en and vi string lengths, and motion that respects reduced motion

## Scope
- [ ] `/impeccable critique` on the welcome with the toolkit step (and the chat card), with the snapshot saved
- [ ] `/impeccable polish` (or `redesign` if the critique has P0/P1 issues) applied to the four components; reuse DESIGN.md tokens and add no new colours outside them
- [ ] Keyboard: tab order through the checkboxes → Install → dialog; focus returns after the dialog closes; result rows are announced (`aria-live`)
- [ ] Write `## Design decisions (/impeccable)` in this task file
- [ ] Update e2e selectors in `e2e/toolkit.mjs` only if the markup changes; the assertions stay the same

**Out of scope:** behaviour changes (ranking, install flow, the tool); new catalog items; other welcome sections.

## Files
- `src/components/toolkit/ToolkitPicker.tsx`, `src/components/toolkit/ToolkitConfirmDialog.tsx`
- `src/components/welcome/ToolkitStep.tsx`, `src/components/chat/ToolkitCard.tsx`
- `src/i18n/welcome.ts` (copy edits from the critique only)
- `e2e/toolkit.mjs` (selectors only, if needed)

## Acceptance criteria
- [ ] The critique snapshot exists in `.impeccable/critique/`, and its P0/P1 findings are fixed or listed as deferred with a reason
- [ ] Installed, unticked, installing, ✓ and error rows are visually distinct in light and dark
- [ ] Keyboard-only: tick 2 items, confirm and read the results without a mouse; focus returns to the step
- [ ] Vietnamese strings don't break the layout on the welcome or in the chat card
- [ ] `e2e/toolkit.mjs`, `e2e/first-screen.mjs` and `e2e/i18n.mjs` pass unchanged in behaviour

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH PORT=3081 pnpm dev:next &
BASE=http://localhost:3081 node e2e/toolkit.mjs
BASE=http://localhost:3081 PW_DIR=. node e2e/first-screen.mjs
BASE=http://localhost:3081 PW_DIR=. node e2e/i18n.mjs
```
