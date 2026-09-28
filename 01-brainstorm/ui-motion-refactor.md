# Plan: UI motion & polish refactor
**Date:** 2026-09-28

## Problem
Panels, modals and menus pop in and out, cards teleport, and some surfaces show the wrong theme. The main cause is **one missing dependency**.

## Constraints
- Tailwind only; no framer-motion or CSS-in-JS (`tw-animate-css` is OK, it's pure CSS).
- Tokens live in `src/app/globals.css`. No new colors.
- Each phase passes `pnpm build` + `pnpm lint` without adding to the 16 existing react-hooks errors.

## Critique

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| 1 | `tw-animate-css` isn't installed, so all `animate-in/out` classes are no-ops. | `ui/dialog.tsx:22,39`, `ui/sheet.tsx:24-43`, `ui/dropdown-menu.tsx:50`, `ui/tooltip.tsx:20` | Confirmed |
| 2 | Task panel, help modal and chat are hand-rolled, with no enter/exit animation. | `TaskDetailPanel.tsx:49,62`, `(app)/layout.tsx:94,114` | Confirmed |
| 3 | Moved cards jump twice (optimistic top-of-column, then server order). | `AppContext.tsx:117-145` | Likely |
| 4 | Ad hoc durations, `transition-all`, no reduced-motion support. | `globals.css:51-53,154-155`, `TaskCard.tsx:61` | Confirmed |
| 5 | shadcn primitives use `slate-*`/`bg-white` (~40 uses) and a separate `--sidebar-*` HSL block; base border is light gray in dark mode. | `components/ui/*`, `globals.css:70-73,160-181` | Confirmed |
| 6 | Fonts via CSS `@import` block render and cause FOUT. | `globals.css:1` | Confirmed |
| 7 | `.prose-dark` and scrollbar hardcode dark hex; broken in light theme. | `globals.css:119-140` | Confirmed |

## Refactor phases (ordered by impact per line of diff)

### Phase 0: Install `tw-animate-css` (≈2 lines)
- `pnpm add tw-animate-css` + `@import "tw-animate-css";` after `@import 'tailwindcss'`. Fixes dialog, sheet, dropdown, tooltip, Cmd+K.
- **Verify:** Cmd+K and dropdowns animate in and out.

### Phase 1: Motion tokens + reduced motion
- Add ease tokens and 3 durations (120/180/260ms) in `@theme`; use them in existing keyframes.
- Add a `prefers-reduced-motion` override; replace `transition-all` with specific properties.
- **Verify:** with macOS "Reduce motion" on, nothing animates.

### Phase 2: Retheme `components/ui/*`
- Swap `slate-*`/`bg-white` for project tokens; alias `--sidebar-*` to `--rgb-*`; base border → `var(--color-border)`.
- **Verify:** light/dark × 4 accents, no white popovers in dark.

### Phase 3: Overlays onto primitives
- `TaskDetailPanel` → `Sheet side="right"`; help modal → `Dialog`.
- `ChatPanel` **decision:** **A (recommended)** keep mounted, animate `w-0 ↔ w-[380px]`; **B** add `animate-slide-in` only (no exit animation).
- **Verify:** task, `?`, `c` animate both ways.

### Phase 4: Board moves
- Wrap optimistic `setBoard` in `startViewTransition` (feature-detected) with per-card `viewTransitionName`.
- Insert moved card at server-order position to kill the double jump; add `opacity-50` drag state. No DnD library.
- **Verify:** a dragged card glides into place once.

### Phase 5: Fonts
- Use `next/font/google` in `app/layout.tsx`; drop the CSS `@import`.

### Phase 6 (optional): Theme-aware prose
- Move `.prose-dark` and scrollbar to `rgb(var(--rgb-*))`.

## Out of scope
- Route transitions (revisit after Phase 4).
- Project-switch skeleton.
- JS animation libraries.

## Review gate
`design-critic` pass on both themes after Phase 2.
