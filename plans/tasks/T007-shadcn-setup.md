# T007: Setup shadcn/ui — components.json, tailwind mapping, clsx/twMerge
**Status:** ✅ Done
**Phase:** 2 — Componentization
**Size:** S (1 hr)
**Depends on:** —

## What to build
Bootstrap shadcn/ui into the project without touching globals.css or removing existing Tailwind tokens.

## Scope
- [x] Install `clsx` and `tailwind-merge` via pnpm
- [x] Create `components.json` with `cssVariables: false`
- [x] Extend `tailwind.config.ts` with shadcn semantic aliases alongside existing tokens
- [x] Create `src/lib/utils.ts` with `cn()` utility
- [x] Run `pnpm dlx shadcn@latest add button input badge separator scroll-area tooltip dropdown-menu dialog skeleton`

## Acceptance criteria
- [x] shadcn UI components land in `src/components/ui/`
- [x] `npm run build` passes
- [x] No visual regressions

## Definition of done
`src/components/ui/button.tsx` exists and the build passes.
