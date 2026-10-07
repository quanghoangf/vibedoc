# T506: Linked docs panel without duplicates, redesigned with /impeccable bolder
**Status:** 👀 Review
**Phase:** R095 — UI enhancements
**Size:** M (2–3 hrs)
**Covers:** S3

## Goal
The Linked docs panel on a doc lists the same item twice: e.g. T215, T217, T223 and R078 appear under **Links to** and again under **Linked from**, so 15 rows hold 12 items and the panel is mostly repetition. Merge both directions into one row per item that says which way it links, and rework the panel's hierarchy with `/impeccable bolder` so the relationships read at a glance.

## Context
- Epic: `plans/roadmap/R095-ui-enhancements.md`
- Panel: `src/components/docs/LinkedDocs.tsx` (160 lines). `section(t("docs.linksTo"), out, …)` and `section(t("docs.linkedFrom"), links.in, …)` at `LinkedDocs.tsx:146-147` render the two lists independently; rows are grouped by kind with `GROUPS` (Tasks / Epics / Docs) and get status icons from AppContext `board`.
- Data: `docLinks(graph, path)` in `src/lib/doc-links.ts:295` returns `{ out, in, broken, stale, targets }`, each `LinkRow = { path, kind, label, line, text, context? }`. Keep the API; merging is a view concern (a pure helper, so it can be checked).
- The same rows feed the link count on the doc header button (unique files counted once, `DocViewer.tsx`) and the `LinkPreview` hover card (`data-preview-*` attributes) — both must keep working.
- Design language: DESIGN.md ("Doc Link Graph" section for link vocabulary; Lab Violet accent only for selection; Pencil Grey for muted). UI text in `src/i18n/docs.ts` (en + vi).
- Run `/impeccable bolder` on the panel before coding the markup: it decides the visual direction (hierarchy, direction markers, density). Record its decisions in this task's report.

## Scope
- [ ] Pure `mergeLinkRows(out, in)` in `src/lib/doc-links.ts` → one row per path with `direction: 'out' | 'in' | 'both'`, the `in` side's line/context kept for the snippet; `doc-links.check.mts` covers it
- [ ] `LinkedDocs`: one list grouped by kind (Tasks / Epics / Docs), each row once, with a clear direction marker (→ links to, ← linked from, ⇄ both) and a short legend or filter (All / To / From) if `/impeccable bolder` calls for it
- [ ] Apply the `/impeccable bolder` direction: stronger hierarchy between group headers, item title and snippet; keep row density usable at the panel's width; no new colors outside the tokens
- [ ] Counts in the header reflect unique items; broken / stale lists unchanged
- [ ] Keyboard and `LinkPreview` hover still work on every row

**Out of scope:** the /graph page, the doc graph data model, broken/stale sections' layout

## Files
- `src/lib/doc-links.ts`, `src/lib/doc-links.check.mts`
- `src/components/docs/LinkedDocs.tsx`
- `src/i18n/docs.ts`
- `e2e/docs-links.mjs` — update the Linked docs assertions

## Acceptance criteria
- [ ] On `plans/tasks/T216-*.md`, T215 / T217 / T223 / R078 appear once each, marked as linking both ways; items only linked from show the "from" marker with their line snippet
- [ ] Total rows = unique linked items (12 instead of 15 for T216)
- [ ] Clicking a row opens the item; hover shows the preview card
- [ ] Light + dark themes, 390px width, Vietnamese labels all correct
- [ ] `node src/lib/doc-links.check.mts` and `e2e/docs-links.mjs` pass

## Verify
```bash
node src/lib/doc-links.check.mts
pnpm build
PORT=3195 pnpm dev   # separate terminal
BASE=http://localhost:3195 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright node e2e/docs-links.mjs
```

## Design decisions (/impeccable bolder)
- **One list, not two.** "Links to" and "Linked from" are merged into a single list (pure `mergeLinkRows`); direction became a per-row property instead of a section, so the repetition is gone and the panel reads as one set of relationships.
- **All / To / From filter** at the top as a segmented control with unique counts (`All 14 · To 4 · From 14` on T216). It replaces the two section headers as the panel's header and gives back the one-direction view the old sections had.
- **Stronger group headers:** Tasks / Epics / Docs promoted from a muted 11px line to Label Caps with the kind icon, a count and a hairline rule under it.
- **Item title leads:** 13px medium in text colour; id stays mono 11px muted; the snippet (`L33 · context`) sits indented below in 11px muted, shown for rows that link here (where the other file names this one), never for out-only rows.
- **Direction marker** at the row's right edge as a lucide icon (ArrowRight → links to, ArrowLeft ← linked from, ArrowLeftRight ⇄ both), with a tooltip and screen-reader text. "Both" is drawn in text colour, one-way in Pencil Grey, so mutual links stand out without a new colour. No glyphs, no new tokens, broken / stale sections untouched.

## Manual tests
_2026-10-07 — ai:claude-code_
### Steps
- [ ] S3 — WHEN /docs?doc=plans/tasks/T216-dates-numbers-vietnamese-glyphs.md is opened → THEN Linked docs lists T215, T217, T223 and R078 once each with the ⇄ marker, and T218… T224 with ← and an `L27 · …` snippet (14 rows for 14 unique files)
- [ ] Click To, then From, then All in the panel → the list narrows to that direction and the counts match the rows shown
- [ ] Hover a row → its preview card shows; click a row → the task / epic / doc opens
- [ ] The panel reads clearly in light and dark themes, and in Vietnamese at 390px (the Linked docs sheet)
### Regression risk
- [ ] The doc header's link count still counts unique files, and the Broken / Stale paths sections and Show in graph still work
