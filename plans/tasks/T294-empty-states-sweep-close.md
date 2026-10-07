# T294: Every-route empty-state sweep, docs, close R083
**Status:** 👀 Review
**Owner:** ai:claude-code
**Started:** 2026-10-07
**Phase:** R083 — Teaching empty states
**Size:** S (~1 hr)
**Depends on:** T291, T292, T293
**Covers:** S1, S2, S3, S4

## Goal
Prove the epic's Done-when: every `(app)` page shown for an empty project has a "what fills this" line and one action, checked across the full route list.

## Context
- Epic: `plans/roadmap/R083-teaching-empty-states.md`
- `e2e/i18n.mjs` finds every route from `src/app/(app)/` (the `ROUTES` discovery); copy that discovery into `e2e/empty-states.mjs` so a new page fails until it's listed.

## Scope
- [ ] `e2e/empty-states.mjs`: discover routes from the folder; every route is either checked or in an explicit `NOT_EMPTY` list with a reason (`/settings`, `/setup`, `/getting-started` always have content); fail on an unlisted route. Run at 1400px and 390px, en and vi, no agent and after an MCP call (S2/S3).
- [ ] MEMORY.md Key conventions: one line (shared `EmptyState` + `data-empty-state`/`data-empty-action`, `useAgentConnected` + `CONNECT_HREF` seam for R081, e2e path); DESIGN.md: empty-state pattern (title, lead, one primary action, connect line) if DESIGN.md has a states section.
- [ ] Set R083 `**Status:** done` once every task is done.

## Files
- `e2e/empty-states.mjs`, `memory/MEMORY.md`, `DESIGN.md`, `plans/roadmap/R083-teaching-empty-states.md`

## Notes
- Built: the sweep found /docs on phones showed an empty list and hid the viewer's empty state; `DocsTab` now shows the viewer when the project has no docs. R083 stays `in-progress` until a human approves T290–T294 (the scope's last step).

## Acceptance criteria
- [ ] `e2e/empty-states.mjs` checks every `(app)` route (or names why not) and passes
- [ ] `e2e/i18n.mjs` passes
- [ ] MEMORY.md documents the pattern and the R081 seam

## Verify
```bash
node src/lib/i18n.check.mts
pnpm lint && pnpm build
BASE=http://localhost:3083 PW_DIR=. node e2e/empty-states.mjs
BASE=http://localhost:3083 PW_DIR=. node e2e/i18n.mjs
```

## Manual tests
_2026-10-07 — ai · Spec: `e2e/vibedoc/T294-empty-states-sweep-close.spec.ts` · Auto: passed 2026-10-07_
### Steps
- [x] 🤖 S1 — WHEN the user opens every page of an empty project → THEN each says what fills it and offers one action
- [x] 🤖 S2 — WHEN no agent is connected → THEN agent actions link to Connect
- [x] 🤖 On a phone (390px), /docs in an empty project shows the docs empty state with New doc
- [x] 🤖 S3 — WHEN an agent has called VibeDoc → THEN the connect lines are gone
- [x] 🤖 S4 — WHEN the language is Tiếng Việt → THEN every empty state is Vietnamese
- [ ] Read each empty state once as a new user (en and vi): the sentence explains what appears and why, and the action is the obvious next step
### Regression risk
- [ ] /docs on a phone with docs still opens on the list, and picking a doc still shows it
