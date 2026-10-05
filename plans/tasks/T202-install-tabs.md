# T202: Install tabs: npx · npm · pnpm · bun (copy on click)
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** T201
**Covers:** S1

## Goal
A visitor picks how they install tools and copies the exact command in one click, right under the headline.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`, scenario S1 (copy an install command).
- Channels that work today with the published `vibedoc` package: `npx vibedoc`, `npm install -g vibedoc`, `pnpm add -g vibedoc`, `bun add -g vibedoc` (then run `vibedoc`). Homebrew (R072) and the AI-assistant prompt (R073) are not shipped yet.
- OpenSpec's site does the same with one tab per package manager.

## Scope
- [ ] `site/src/data/install.ts`: one entry per channel `{ id, label, command, note? }`; the tab list renders from it, so R072/R073 add Homebrew / the prompt by adding an entry
- [ ] Accessible tabs (`role=tablist`, arrow keys move between tabs), the selected tab's command with the copy button from T201, and a one-line note under global installs ("then run `vibedoc` in your project")
- [ ] The chosen tab is remembered for the page view only (no storage needed)
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

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] S1 — WHEN a visitor picks an install tab (npx, npm, Homebrew, AI assistant) and clicks copy → THEN that exact command is on their clipboard and the button confirms it
