# T291: Roadmap, graph, docs and explorer empty states
**Status:** 📋 Todo
**Phase:** R083 — Teaching empty states
**Size:** M (2–3 hrs)
**Depends on:** T290
**Covers:** S1, S2, S4

## Goal
The planning and reference pages of an empty project say what fills them and give one primary action, using T290's `EmptyState`.

## Context
- Epic: `plans/roadmap/R083-teaching-empty-states.md`
- Reuse `EmptyState`, `CopyCommand`, `useAgentConnected` from T290 (`src/components/shared/`).
- Roadmap today (`RoadmapTab.tsx:497-520`): "No roadmap yet" + four equal buttons (Generate, Plan with agent, Plan from spec, Create first horizon). Keep them, but one is primary.
- Graph (`DocGraph.tsx:859`): "No links between docs yet…" fires for no-docs and no-links alike.
- Docs (`DocViewer.tsx:55-80`) already has a line + "New doc"; wrap it so it carries `data-empty-state` / `data-empty-action`, wording unchanged unless it lacks the "why".
- Explorer (`ExplorerTab.tsx:183`): shows "No files match your search" with no search typed.

## Scope
- [ ] Roadmap: lead = epics live here, the agent breaks them into tasks. Primary action = "Generate roadmap" when `generateSource` is ROADMAP.md or tasks; otherwise copy `/vibedoc:roadmap` (needsAgent). The other buttons stay as secondary (plain/ghost) so there's one primary.
- [ ] Graph: no docs → lead on what the graph shows (links between docs, tasks, epics) and the action "New doc" (link to `/docs`); docs without links → keep today's hint as the lead with a link to /docs.
- [ ] Docs: mark the existing empty state (`data-empty-state`, `data-empty-action` on New doc).
- [ ] Explorer: no files and no query → "the repo's files appear here, sized by…" + action link to /docs (or /setup "Write project docs" if that fits better); search-with-no-match keeps "No files match your search".
- [ ] i18n `roadmap.ts`, `docs.ts`, `en` + `vi`.
- [ ] Extend `e2e/empty-states.mjs` PAGES with /roadmap, /graph, /docs, /explorer.

**Out of scope:** changing generateRoadmap itself; R082's welcome screen.

## Files
- `src/components/roadmap/RoadmapTab.tsx`, `src/components/graph/DocGraph.tsx`, `src/components/docs/DocViewer.tsx`, `src/components/explorer/ExplorerTab.tsx`
- `src/i18n/roadmap.ts`, `src/i18n/docs.ts`
- `e2e/empty-states.mjs`

## Acceptance criteria
- [ ] Each of the four pages in an empty project: one `[data-empty-state]` with a lead and exactly one `[data-empty-action]`
- [ ] Roadmap: connect line only when the primary action is the `/vibedoc:roadmap` command and no agent yet
- [ ] Explorer with a search that matches nothing still says so
- [ ] vi passes `node src/lib/i18n.check.mts` and `e2e/i18n.mjs`

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3083 PW_DIR=. node e2e/empty-states.mjs
BASE=http://localhost:3083 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
### Steps
- [ ] S1 — WHEN the user opens /roadmap, /graph, /docs, /explorer in an empty project → THEN each says what fills it and offers one action
- [ ] S2 — WHEN no agent is connected → THEN the roadmap's command action has the Connect link
- [ ] S4 — WHEN the language is Tiếng Việt → THEN these empty states are Vietnamese
