# T334: "Try the demo" links, docs, and the epic's end-to-end check
**Status:** 📋 Todo
**Phase:** R085 — Demo playground
**Size:** S (~1 hr)
**Depends on:** T331, T332, T333
**Covers:** S1, S2, S3

## Goal
People find the demo: the site and the README say `npx vibedoc --demo`, and the welcome screen has a ready-made "Try the demo" link to drop in. The epic's Done-when is checked end to end.

## Context
- Epic: `plans/roadmap/R085-demo-playground.md` — "a 'Try the demo' link on the site and the welcome".
- The welcome screen is R082's scope and isn't built here. Decision (seam): ship a `TryDemo` component (the command `npx vibedoc --demo` + copy button, i18n) that R082 can render; note it in R082's direction in this task's report. Don't build or edit the welcome.
- Site: install channels are one list in `site/src/data/install.ts`; analytics events use `data-goatcounter-click` (`site/src/data/links.ts`). Site test: `pnpm --dir site test`.
- Docs: `docs/getting-started.md` (shipped in the npm package) and `README.md`.

## Scope
- [ ] `src/components/shared/TryDemo.tsx` — the command + copy button; text in `src/i18n/` (en + vi); not rendered anywhere yet (R082 seam), or on `/setup` if that page has a natural spot
- [ ] Site: a "Try the demo" line/button next to the install tabs with `npx vibedoc --demo`, `data-goatcounter-click="copy-demo"`
- [ ] `README.md` and `docs/getting-started.md`: one short section "Try the demo" (what it shows, that it's a throwaway copy)
- [ ] `bin/vibedoc.mjs --help` (if a help text exists) lists `--demo`
- [ ] End to end: `e2e/demo-playground.mjs` also checks the board is populated, T004's video URL returns 200 `video/webm`, and the memory graph API returns edges
- [ ] MEMORY.md "Key conventions": one line on R085 (playground mode, temp copy, runs dir, seams); epic `**Status:**` → done when all tasks are done

**Out of scope:** R082's welcome screen; a hosted online demo.

## Files
- `src/components/shared/TryDemo.tsx` — new
- `src/i18n/*.ts`
- `site/src/…` — install section
- `README.md`, `docs/getting-started.md`
- `e2e/demo-playground.mjs` — end-to-end checks
- `memory/MEMORY.md`, `plans/roadmap/R085-demo-playground.md`

## Acceptance criteria
- [ ] Site shows the demo command and `pnpm --dir site test` passes
- [ ] README and getting-started mention `npx vibedoc --demo`
- [ ] `e2e/demo-playground.mjs` passes: populated board, playable video, memory graph edges, nothing left behind
- [ ] `pnpm lint`, `pnpm build`, `node src/lib/i18n.check.mts` pass

## Manual tests
- [ ] S1 — WHEN the user runs `vibedoc --demo` → THEN the browser opens a populated sample project with a Demo banner
- [ ] S2 — WHEN the user edits or moves things in the demo and quits → THEN no file outside VibeDoc's temporary demo copy has changed
- [ ] S3 — WHEN the user clicks "Use VibeDoc on my project" → THEN they get the command for their own repo

## Verify
```bash
pnpm lint && pnpm build && node src/lib/i18n.check.mts
pnpm --dir site test
PW_DIR=<dir with playwright> node e2e/demo-playground.mjs
```
