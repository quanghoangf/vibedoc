# T202: Install tabs: npx · npm · pnpm · bun (copy on click)
**Status:** 👀 Review
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** T201
**Covers:** S1
**Owner:** ai:claude-code
**Due:** 2026-10-08
**Started:** 2026-10-05

## Goal
A visitor picks how they install tools and copies the exact command in one click, right under the headline.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`, scenario S1 (copy an install command).
- Channels that work today with the published `vibedoc` package: `npx vibedoc`, `npm install -g vibedoc`, `pnpm add -g vibedoc`, `bun add -g vibedoc` (then run `vibedoc`). Homebrew (R072) and the AI-assistant prompt (R073) are not shipped yet.
- OpenSpec's site does the same with one tab per package manager.

## Design
- Approved design: `site/design/landing.dc.html` (direction "C · Lab notebook"; section map, tokens and motion in `site/design/README.md`; canvas https://claude.ai/artifact/MMDG5yHgf63oS2dUcLS6nQ). Match its layout, copy, sizes and motion; it is a reference, not code to copy into Astro as is.
- This task builds: the install box in the hero (tabs, dark command block, Copy, the note line under it) and the "Running in a minute" section (three cards: start VibeDoc, connect over MCP, add the plugin).

## Scope
- [ ] `site/src/data/install.ts`: one entry per channel `{ id, label, command, note? }`; the tab list renders from it, so R072/R073 add Homebrew / the prompt by adding an entry
- [ ] Accessible tabs (`role=tablist`, arrow keys move between tabs), the selected tab's command with the copy button from T201, and a one-line note under global installs ("then run `vibedoc` in your project")
- [ ] The chosen tab is remembered for the page view only (no storage needed)
- [ ] "Running in a minute" section: three cards with `npx vibedoc`, the MCP `url` snippet and the two `/plugin` lines, as in the design
- [ ] Playwright: each tab copies its own command

**Out of scope:** Homebrew and AI-assistant entries (R072, R073), analytics on copies (R077).

## Files
- `site/src/data/install.ts` — new
- `site/src/components/InstallTabs.astro` — new; reuses `CopyCommand`
- `site/src/pages/index.astro` — place the tabs under the hero
- `site/e2e/landing.spec.ts` — add the S1 steps

## Acceptance criteria
- [ ] Each of the four tabs shows and copies exactly its command; the button confirms "Copied"
- [ ] Tabs work with the keyboard (Tab into the list, arrows switch, Enter/Space copy)
- [ ] Adding a channel is one new entry in `install.ts` (no markup change)
- [ ] The three install cards show the exact commands from the design

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] S1 — WHEN a visitor picks an install tab (npx, npm, Homebrew, AI assistant) and clicks copy → THEN that exact command is on their clipboard and the button confirms it (npx, npm, pnpm and bun ship now; Homebrew and the AI prompt come with R072 / R073. Proven locally by `site/e2e/landing.spec.ts` "S1: each tab shows and copies exactly its command"; check it on the live page)
- [ ] With the keyboard: Tab into the tabs, ←/→ switch them, Tab again reaches Copy, Enter copies → "Copied"
- [ ] Scroll to "Running in a minute." → three cards: start VibeDoc, the MCP url snippet, the two /plugin lines; long lines wrap instead of being cut off
### Regression risk
- [ ] The hero still reads well at 390 px (tabs fit on one row, Copy stays beside the command)
