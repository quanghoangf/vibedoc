# Landing page design

The approved design for R071 (direction "C · Lab notebook"), exported from the design canvas:
https://claude.ai/artifact/MMDG5yHgf63oS2dUcLS6nQ (private; ask the owner for access).

`landing.dc.html` is the canvas artboard's source. It is a **reference**, not code to ship: the real page is built
in Astro + Tailwind 4 under `site/src/` (tasks T201–T208). Read it for layout, copy, colours, type sizes and motion.
Image and video paths point at the files in `site/public/`.

| Section (top to bottom) | Built by |
|---|---|
| Sticky header: logo, nav, GitHub button with icon + star count | T201 (star count: T206) |
| Hero: pill label, headline with highlighted "proof", subhead, CTAs, "works with" line | T201 |
| Install tabs (npx · npm · pnpm · bun; Homebrew and "Ask your AI" when R072/R073 ship) | T202 |
| Board screenshot in a browser frame + two floating chips | T203 |
| Demo band (dark): the clip with copy | T204 (live demo link: T205) |
| Spec-driven development: problem, without/with, four example cards, brownfield note | T208 |
| The loop: four commands with the drawn line | T203 |
| Feature tour: tabs with screenshots (Board, Roadmap, Evidence, Scenarios, Specs, Memory, Link graph) | T203 |
| Install in three steps + dark closing call to action | T202 (CTA: T206) |
| Footer with GitHub icon, social preview, SEO | T206 |

Tokens: the light "paper" palette in `DESIGN.md` (paper-tint `rgb(248 248 252)`, ink `rgb(26 26 46)`,
pencil `rgb(107 107 128)`, rules `rgb(224 224 238)` / `rgb(208 208 228)`), Lab Violet `#7c6af7` as fill only
(text in violet uses `#5341d6` for contrast), Geist + Geist Mono, a 32 px grid on the page background.

Motion (CSS only): `vd-in` (hero entrance, staggered), `vd-reveal` (scroll-driven rise, `animation-timeline: view()`,
inside `@supports`), `vd-line` (the loop's drawn line), `vd-float` (chips), `vd-pulse` (live dot). Everything is off
under `prefers-reduced-motion`.

Assets in `site/public/`: `screens/*.jpg` (light theme, 2880×1800, taken from the running app; the app's accent was
green, so retake them if the accent changes) and `demo.webm` (14 s draft from `site/scripts/record-demo.mjs`).
