# T513: Mermaid in VibeDoc's own style, errors shown inline
**Status:** 👀 Review
**Phase:** R096 — Visual docs
**Size:** M (2–3 hrs)
**Covers:** S1

## Goal
`` ```mermaid `` diagrams in docs render with VibeDoc's design tokens (DESIGN.md "Lab Notebook": hairlines, one accent, mono labels) in light and dark, instead of Mermaid's stock `neutral` / `dark` themes. A diagram with a syntax error shows the error and its source in place, not a blank box and a console line.

## Context
- Epic: `plans/roadmap/R096-visual-docs.md`
- Today: `MarkdownRenderer.tsx` emits `<div class="mermaid not-prose">` (line ~32) and runs `mermaid.initialize({ theme: dark ? "dark" : "neutral", securityLevel: "antiscript" })` then `run({ nodes })` (line ~160), errors only to `console.error("[mermaid]")`. CSS `.mermaid` in `globals.css:372`.
- Style borrowed from cathrynlavery/diagram-design (MIT): one accent for the one or two things that matter, 1px lines, no shadows, no gradients. Use Mermaid `theme: "base"` + `themeVariables`.
- Tokens are CSS custom properties on `:root` / `.dark` (globals.css). Read them with `getComputedStyle(document.documentElement)` at render time so light/dark both follow; re-render processed diagrams when the theme class changes (a `MutationObserver` on `<html class>` or the existing theme hook, whichever the codebase already uses).
- Keep `securityLevel: "antiscript"`. Pure libs import nothing at runtime from each other (`node *.check.mts`).

## Scope
- [ ] `src/lib/mermaid-theme.ts` (pure): `mermaidThemeVariables(tokens: Record<string,string>)` → `themeVariables` (background transparent, primaryColor = surface, primaryBorderColor/lineColor = rule line, text = ink, one accent = `--primary` for `classDef accent`, fontFamily = the UI mono/sans stacks, fontSize 13px) + `.check.mts`
- [ ] `MarkdownRenderer.tsx`: initialize with `theme: "base"` + those variables; re-render on theme switch (store each diagram's source in `data-source` before Mermaid replaces it)
- [ ] Inline error: `await mermaid.parse(src)` per node first; on failure render `<div class="mermaid-error" role="note">` with the message (first line) and the source in a `<pre>`; keep `console.error` out of the happy path so e2e "no console errors" holds for valid diagrams
- [ ] `globals.css`: `.mermaid svg` without rounded/shadow, edge labels on the page background; `.mermaid-error` uses the CAUTION alert tones from R089
- [ ] `e2e/visual-docs.mjs` — new (copy setup from `e2e/richer-markdown.mjs`): fixture doc with a flowchart and a broken diagram; flowchart node stroke = the rule-line token in light and in dark; the broken one shows `.mermaid-error` with its source

**Out of scope:** zoom/fullscreen/copy (T514), diagram templates (T518), other diagram styles.

## Files
- `src/lib/mermaid-theme.ts`, `src/lib/mermaid-theme.check.mts` — new
- `src/components/docs/MarkdownRenderer.tsx`, `src/app/globals.css`
- `e2e/visual-docs.mjs` — new; later R096 tasks add sections

## Acceptance criteria
- [ ] A flowchart, a sequence and a state diagram read in VibeDoc's tokens in light and dark; switching theme re-colours them without a reload
- [ ] A broken diagram shows its error message and source inline; other diagrams on the page still render
- [ ] The live editor preview still debounces and doesn't flash every keystroke
- [ ] `node src/lib/mermaid-theme.check.mts`, `pnpm build` pass; no new lint errors (baseline 10)

## Verify
```bash
node src/lib/mermaid-theme.check.mts
pnpm build && pnpm lint
PORT=3189 pnpm dev   # separate terminal
PW=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright
BASE=http://localhost:3189 PW_DIR=$PW node e2e/visual-docs.mjs
```

## Manual tests
_Auto: `e2e/visual-docs.mjs` passed 2026-10-12 (items marked [x] are what it proved); `e2e/richer-markdown.mjs` passed (regression). `node src/lib/mermaid-theme.check.mts` + `pnpm build` ok, lint 10 errors (baseline, none in the touched files). Mermaid parse errors show their first and last line ("Parse error on line N: Expecting …"), not the first alone: the first line says only where. Edges use the muted ink, not the rule line: a rule-line arrow is 1.4:1 on white._
### Steps
- [x] S1 — WHEN a doc has a ```mermaid flowchart → THEN it renders with VibeDoc's tokens (hairlines, one accent) in light and dark, matching the rest of the page
- [x] Put a broken ```mermaid block in a doc → a red callout shows "Parse error on line N: Expecting …" and the source; the other diagrams on the page still render
- [ ] Switch Settings → Appearance between light and dark with a doc open → its diagrams re-colour without a reload
- [ ] Open docs/architecture/02-high-level-design/HLD.md → its sequence diagrams read clearly in light and dark
- [ ] In a flowchart, add `class B accent` → node B gets the accent border, nothing else does
### Regression risk
- [x] Code tabs, alerts and a plain code block on the same page render as before
- [ ] Typing in Split mode on a doc with a diagram → the preview diagram updates after a pause and doesn't flicker on every keystroke
