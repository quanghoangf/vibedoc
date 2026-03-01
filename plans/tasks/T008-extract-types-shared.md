# T008: Extract shared types to src/types/index.ts + shared components
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** S (1 hr)
**Depends on:** T007

## What to build
Move type definitions out of page.tsx into `src/types/index.ts`, and create `LoadingScreen` and `EmptyState` shared components.

## Scope
- [x] Create `src/types/index.ts` — re-export from core, add Summary/SelectedDoc/TabId
- [x] Create `src/components/shared/LoadingScreen.tsx`
- [x] Create `src/components/shared/EmptyState.tsx`

## Acceptance criteria
- [x] All types importable from `@/types`
- [x] `npm run build` passes

## Definition of done
page.tsx imports `Summary`, `SelectedDoc`, `TabId` from `@/types`.
