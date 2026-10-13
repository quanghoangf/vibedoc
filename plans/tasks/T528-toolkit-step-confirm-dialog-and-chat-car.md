# T528: Toolkit step, confirm dialog and chat card polished with /impeccable
**Status:** 👀 Review
**Phase:** R098 — Agent toolkit setup
**Size:** M
**Depends on:** T526
**Owner:** ai:claude-code
**Due:** 2026-10-16
**Started:** 2026-10-13

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

## Design decisions (/impeccable)
Critique snapshot: `.impeccable/critique/2026-10-13T02-57-12Z__src-components-welcome-toolkitstep-tsx.md` (26/40, 2 × P1). The user chose: fix all five, preselect the plugins that fit, keep the step on the welcome marked Optional.

- **One ruled list, not cards in a card.** Rows sit in a `divide-y` list inside the step (or the chat card); no border per row. Fixes the detector's nested-cards hit and halves the height.
- **Installed plugins fold into one line.** "Already installed: …" (teal check, muted text) under the list; a row installed from here keeps its place and turns ✓ so the result stays where the user looked.
- **"fits" is metadata, not accent.** Muted mono 11px `fits · git repo` beside the title (Grep Rule); the accent stays for selection, focus and the primary button. With the green accent it no longer reads like the teal ✓.
- **Preselect what fits** (`useToolkit("fits")`): the matched, not-installed plugins come ticked once, on the first load; polls never re-tick what the user unticked. The button counts the picks: "Install 5 plugins".
- **Drawn checkboxes** in the system (as `Tick` in TestDetail), filled with the accent because ticking is selection here, not done-ness.
- **States told apart:** unticked (outline box) · ticked (accent box) · installing (muted mono "installing…" + spinner on the row) · ✓ Installed (teal, box dimmed) · failed (amber token, stderr capped at ~6 lines with scroll, then "Run it yourself" commands).
- **Announced outcome:** one `role=status` line beside the button: "Installing 5 plugins…" → "4 installed · 1 failed" / "Every suggested plugin is installed." It is the progress signal under reduced motion too (the spinner stops there).
- **Focus:** the dialog opens on Cancel; closing it (Cancel, Esc, Install) puts focus back on the Install button, which stays focusable (`aria-disabled`) while installing. The capture-phase Esc listener stays (it keeps the chat modal open).
- **Dialog lists each command once:** plugin names, then marketplace adds (once per marketplace), then installs; the body says a marketplace Claude Code already has is skipped.
- **Copy:** "Optional" marker beside the heading; the chat card uses the same title, "Pick your toolkit"; its saved summary sets plugin ids in mono.
- Light/dark: amber moved from Tailwind `amber-400` to the `text-amber` token (darker ink on paper). Vietnamese checked at 390px.
- Deferred: reasons stay under the title on desktop (one line each fit already); no "select all" shortcut (preselect covers the common case).

## Manual tests
_2026-10-13 — ai_
### Steps
- [ ] Open /start on a project with a web frontend → "Pick your toolkit · Optional": one ruled list, the plugins that fit come ticked, each title has a muted mono "fits · …", the button reads "Install N plugins"
- [ ] Plugins you already have show only as one "Already installed: …" line under the list
- [ ] Keyboard only: Tab to a checkbox, Space to untick, Tab to Install, Enter → the dialog opens on Cancel; Esc → focus is back on the Install button
- [ ] Install a plugin → its row says "installing…", then "✓ Installed"; the line next to the button reads "1 installed"
- [ ] Switch to light theme (Settings → Appearance) and to Tiếng Việt → the list, the "fits" labels and an "Install failed" row stay readable and nothing overflows at phone width
- [ ] Ask the agent in chat to set up the toolkit → the card has the same look, titled "Pick your toolkit"
### Regression risk
- [ ] Settings → Connect agent still shows its own steps and confirm dialog unchanged
