# T137: Show the VibeDoc version in the UI
**Status:** ✅ Done
**Phase:** R025 — vibedoc --version flag
**Size:** S
**Depends on:** T136
**Owner:** ai:claude-code
**Due:** 2026-10-05
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
The app shows the running VibeDoc version (e.g. `v1.4.2`) in the header. Users can tell which build the UI is from without going to a terminal.

## Context
- Epic: `plans/roadmap/R025-vibedoc-version-flag.md`
- Same source as the CLI: VibeDoc's own `package.json` `version`, read at build time. No new API route and no file system access (CLAUDE.md: only `src/lib/core.ts` touches `fs`; a JSON import is bundled, not read at runtime).
- `tsconfig.json` already has `resolveJsonModule: true` (T028).
- Header component: `src/components/layout/AppHeader.tsx` (logo + ProjectSwitcher + StatsPills + LiveIndicator). If the header has moved, put the label next to the logo in its current home.

## Scope
- [ ] `src/lib/version.ts` exports `VIBEDOC_VERSION` from `package.json`
- [ ] Show a small muted `v{VIBEDOC_VERSION}` label next to the logo in the header, with tooltip/title "VibeDoc version"
- [ ] Small check that `VIBEDOC_VERSION` equals `package.json` version

**Out of scope:** update-available notices, a settings/about page, and changes to the CLI (T-previous).

## Files
- `src/lib/version.ts`: new; `import { version } from '../../package.json'` and `export const VIBEDOC_VERSION = version`
- `src/components/layout/AppHeader.tsx`: render the label
- `src/lib/version.check.mts`: new, following the other `src/lib/*.check.mts`

## Implementation notes
- Use the named import `{ version }` so the bundler doesn't ship the whole package.json to the client. If the build complains about named JSON imports, use the default import and pick `.version`.
- Tailwind only. Match the muted text style already used by StatsPills / the MCP hint. Keep it on one line, and hide it at narrow widths if the header wraps.

## Acceptance criteria
- [ ] Header shows `v<package.json version>` on every page that uses the app shell
- [ ] Bumping `package.json` version and rebuilding updates the label
- [ ] No new `fs` usage outside `core.ts`; no new API route
- [ ] Check script passes; `npm run build` passes

## Verify
```bash
node src/lib/version.check.mts
npm run lint && npm run build
npm run dev   # open http://localhost:3000 → version label next to the logo
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Open http://localhost:3000/board with the sidebar expanded. A small muted mono `v1.12.0` shows right after the "VibeDoc" logo text.
- [ ] Hover the `v1.12.0` label. The tooltip reads "VibeDoc version".
- [ ] Go to /roadmap, /docs, /memory, /chat and /settings. The label is there on each one, because they all use the app shell sidebar.
- [ ] Collapse the sidebar to icon mode (sidebar trigger or shortcut). The label and the "VibeDoc" text both hide, and the hexagon icon stays centred without overflow.
- [ ] Change `version` in package.json to a test value (e.g. 1.12.1) and run `npm run build && npm start`. The label shows the new version. Change it back afterwards.
### Regression risk
- [ ] Sidebar header layout: with a long or prerelease version (e.g. `1.12.0-beta.3`), the logo row stays on one line and the label truncates instead of pushing the header taller.
- [ ] Phone width (sidebar opens as a sheet): the logo row still looks right and the label does not wrap.
