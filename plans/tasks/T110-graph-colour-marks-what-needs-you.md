# T110: Colour marks what needs you; light-theme contrast
**Status:** 📋 Todo
**Phase:** R056 — Doc link graph
**Size:** M (2–3 hrs)
**Depends on:** T109

## Goal
The graph's colour points at work that needs attention, not at finished work, and holds contrast in both themes and under every accent. Decision: keep the whole-repo graph, make active and recently touched files stand out.

## Context
- Snapshot: `.impeccable/critique/2026-10-02T06-44-54Z__src-app-app-graph-page-tsx.md` (P1 colour). Done teal dots measure 1.78:1 in light (fail 3:1) — `--color-teal` is a fixed #4fd8b4 in both themes (globals.css:22) via STATUS_COLOR_CLASS.teal. With all kinds on, 100+ teal Done dots bury 3 amber epics. Under the green accent, selection ≈ Done teal.
- DESIGN.md Highlighter Rule ("only colours what you can act on now"), One Status Language, Triplet Rule. Refs: colorize.md, craft-floor.md.
- Code: DocGraph.tsx (hue, DotView ring, legend), globals.css tokens, src/components/shared/status-defs.ts / STATUS_COLOR_CLASS, /api/activity (activity log).

## Scope
- [ ] Graph only: done and cancelled tasks/epics draw as hollow Pencil Grey shapes (same shape language), so todo stays neutral and in-progress / blocked / review / custom active statuses keep their hue.
- [ ] "Touched recently": files an agent or human changed in the last 24h (from the activity log: task moves, doc edits, entry saves; resolve to node paths) get a small accent tick/notch on the dot (not a fill) and a "Recent" toggle chip that dims everything else. Live ping still marks changes as they happen.
- [ ] Selection independent of hue: a double ring (accent ring + bg gap + outer hairline) so it reads even when accent ≈ a status hue; search matches use a dashed ring.
- [ ] Light theme: add a light value for the teal status token (and check amber/red/violet) so status ink is ≥ 3:1 on paper as a non-text mark and ≥ 4.5:1 where it's text — fix at the token level (affects board/status icons too; verify they still look right).
- [ ] Legend lists every status category present (incl. review, paused) + "hollow = done".

## Acceptance criteria
- [ ] All kinds on: done items are hollow grey; active items are the only coloured dots.
- [ ] Teal status token ≥ 3:1 on white (measured); board Done icons still legible in both themes.
- [ ] With the green accent: the selected node is clearly distinguishable from a Done/active dot (screenshot).
- [ ] Recent chip shows files touched in the last 24h on this repo.

## Verify
```bash
pnpm build && pnpm lint
PW_DIR=/Users/hoangquangnguyen/work/miniapp BASE=http://localhost:3000 node e2e/docs-links.mjs
# screenshots: all kinds dark + light, green and violet accents, Recent on
```
