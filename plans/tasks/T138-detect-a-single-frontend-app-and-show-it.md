# T138: Detect a single frontend app and show it on Settings
**Status:** ✅ Done
**Phase:** R057 — Frontend app detection
**Size:** M
**Depends on:** —
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
VibeDoc reads the target project, finds a single-package web frontend (Next, Vite, etc.) at `VIBEDOC_ROOT`, and shows the app, start command and URL in a new "Frontend app" section on /settings. This is the thin end-to-end slice the rest of R057 builds on.

## Context
- Epic: `plans/roadmap/R057-frontend-app-detection.md`
- Decided: a thin vertical slice first. This task handles only a root `package.json`. Monorepos come in T2.
- CLAUDE.md: "`src/lib/core.ts` is the only place that touches the file system." Detection reads files only through core.
- CLAUDE.md: `page.tsx` / pages fetch through our own API routes. No server components in the main UI.
- Settings page: `src/app/(app)/settings/page.tsx` (see T083 for how a settings section was added).

## Scope
- [ ] `detectFrontend(root)` in `src/lib/core.ts` returns a `FrontendApp | null` for the root package
- [ ] Framework from dependencies: next, vite, @remix-run/*, astro, nuxt, @sveltejs/kit, react-scripts; anything else is `unknown` / null
- [ ] Package manager from the lockfile (pnpm-lock.yaml, yarn.lock, bun.lockb, package-lock.json → npm)
- [ ] Start command: `<pm> run dev` (fall back to `start`); URL from `--port`/`-p` in that script, else the framework's default port
- [ ] `GET /api/frontend` returns the detection result
- [ ] "Frontend app" section on /settings: name, framework, dir, start command, URL; empty state "No web frontend found"
- [ ] Unit tests on fixture dirs: Next app, Vite app, a repo with no frontend

**Out of scope:** monorepos and settings overrides (T2), Playwright status (T4), auth state (T6), MCP/status (T3).

## Files
- `src/lib/core.ts`: add `detectFrontend()` and the `FrontendApp` type
- `src/app/api/frontend/route.ts`: new, GET only
- `src/app/(app)/settings/page.tsx`: add the Frontend app section
- test fixtures + test file: use the repo's existing unit test setup (check `package.json`). If there is none, use a `node:test` script under `e2e/` or `scripts/` and say so in the commit

## Implementation notes
This is the shape later tasks extend. Keep the field names stable:
```ts
type FrontendApp = {
  dir: string            // relative to VIBEDOC_ROOT, "." for root
  name: string           // package.json name
  framework: 'next'|'vite'|'remix'|'astro'|'nuxt'|'sveltekit'|'cra'|'unknown'
  packageManager: 'npm'|'pnpm'|'yarn'|'bun'
  startCommand: string   // e.g. "pnpm run dev"
  url: string            // e.g. "http://localhost:5173"
  source: 'detected'|'override'
}
```
Default ports: next/nuxt/cra/remix 3000, vite/sveltekit 5173, astro 4321. If the app is VibeDoc's own repo, or the URL clashes with VibeDoc's own `PORT`, still report it but show a note on Settings.

## Acceptance criteria
- [ ] `VIBEDOC_ROOT=<a Next app>` → /settings shows framework next, `npm run dev` (or the right pm), `http://localhost:3000`
- [ ] A Vite app with `"dev": "vite --port 4000"` → URL `http://localhost:4000`
- [ ] A docs-only repo → "No web frontend found", no errors
- [ ] Unit tests cover the three fixtures and pass

## Verify
```bash
npm run lint && npm run build
# run the unit tests
VIBEDOC_ROOT=<fixture next app> npm run dev   # open /settings
curl localhost:3000/api/frontend
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Open /settings → "Frontend app" (both the sidebar and the phone tab strip). For this repo it shows vibedoc / Next.js / `.` / `pnpm run dev` / `http://localhost:3000`, with two amber notes: own repo and port 3000 clash.
- [ ] Switch to another project with the project switcher (one with a Vite app or none) and reopen the Frontend app tab. The section refetches for that project and does not keep the previous project app.
- [ ] Run VibeDoc with `PORT=3101` against a Next app. The port-clash note disappears and the URL still reads `http://localhost:3000`.
- [ ] Point VibeDoc at a project whose root package.json has no web framework (e.g. a CLI package). It shows the "No web frontend found" box, not an error.
- [ ] At phone width (~375px), a long start command or URL truncates inside its row and the page does not scroll sideways.
### Regression risk
- [ ] Other settings tabs (Appearance, Project, Statuses, MCP, Skills, Agents) still load and save. The settings page only gained a tab entry and one render line.
- [ ] The /docs list and /graph do not show the new `src/lib/frontend-fixtures/` dirs as docs. They contain only package.json, lockfiles and a .txt file, no .md.
