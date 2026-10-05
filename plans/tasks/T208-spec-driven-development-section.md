# T208: Spec-driven development section
**Status:** 📋 Todo
**Phase:** R071 — Landing page
**Size:** M (2–3 hrs)
**Depends on:** T201

## Goal
A visitor understands why VibeDoc is spec-driven and what that looks like in practice, in one section: the problem, the difference, and the four steps with real examples.

## Context
- Epic: `plans/roadmap/R071-landing-page.md`. The section explains R066–R069 as shipped: capability specs (`docs/specs/<capability>.md`, requirements + WHEN/THEN scenarios), the related spec an agent sees when it claims a task, epic `## Scenarios` as acceptance tests, verification findings, and merging an epic's `## Spec changes` into the spec.
- Claims must match what ships: no OpenSpec import yet (R070 is planned), so the brownfield note only says VibeDoc uses the same delta idea (ADDED, MODIFIED, REMOVED, RENAMED).

## Design
- Approved design: `site/design/landing.dc.html` (direction "C · Lab notebook"; section map, tokens and motion in `site/design/README.md`; canvas https://claude.ai/artifact/MMDG5yHgf63oS2dUcLS6nQ). Match its layout, copy, sizes and motion; it is a reference, not code to copy into Astro as is.
- This task builds the `#sdd` section: label, "Vibe coding forgets. Specs remember.", the intro paragraph, the "Without specs / With VibeDoc" pair, the four example cards (capability spec, epic, verify findings, merge diff with Accept) and the brownfield note.

## Scope
- [ ] `site/src/components/SpecDriven.astro` with the section as designed; code samples as real text in `<pre>` (selectable, readable by screen readers), not images
- [ ] Cards reveal on scroll (`vd-reveal`); the four cards stack to one column at 390 px
- [ ] Nav "Spec-driven" link scrolls to `#sdd`
- [ ] Playwright: the section, its heading and the four cards render at phone and desktop widths; the nav link lands on it

**Out of scope:** a dedicated SDD docs page (R074), OpenSpec import (R070).

## Files
- `site/src/components/SpecDriven.astro` — new
- `site/src/pages/index.astro` — place it after the demo band
- `site/e2e/landing.spec.ts`

## Acceptance criteria
- [ ] The section shows the heading, the without/with lists and the four example cards with their code text
- [ ] No horizontal scroll at 390 px
- [ ] Every claim in the section is true for the shipped product (checked against R066–R069)

## Verify
```bash
pnpm --dir site build && pnpm --dir site exec playwright test
```
