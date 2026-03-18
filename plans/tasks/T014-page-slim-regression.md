# T014: Finalize page.tsx as slim orchestrator + full regression test
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** S (1 hr)
**Depends on:** T007, T008, T009, T010, T011, T012, T013

## What to build
Replace page.tsx content with a slim ~120 line orchestrator that imports all extracted components. Remove all inline helpers and component definitions.

## Scope
- [x] Replace page.tsx with slim orchestrator
- [x] Remove all inline component definitions from page.tsx
- [x] Remove cn(), renderMarkdown(), groupDocsBySection(), timeAgo() helpers from page.tsx
- [x] Remove inline type definitions from page.tsx
- [x] `npm run build` passes clean
- [x] `npm run lint` passes clean

## Acceptance criteria
- [x] All 4 tabs load and function correctly
- [x] SSE live updates work
- [x] Board moves task
- [x] Doc search + markdown rendering work
- [x] `npm run build` passes

## Definition of done
page.tsx is ~120 lines, app works end-to-end, build and lint pass.
