# T534: A second `npx vibedoc` opens its repo in the running hub
**Status:** 📋 Todo
**Phase:** R100 — Auto-detect current repo
**Size:** M (2–3 hrs)
**Depends on:** T533
**Covers:** S2

## Goal
When VibeDoc is already running, `npx vibedoc` in another repo adds that repo to the running hub and opens it there, never starting a second server.

## Context
- Epic: `plans/roadmap/R100-auto-detect-current-repo.md` — builds spec ADDED `Open the current repo` (scenario "Already running")
- Today `resolveAddress` / `probeVibedoc` (`bin/address.mjs`) treat "running" as "running for this root" (`/api/projects` `[0].root`). Now "running" = a VibeDoc hub answers on the home port, whatever its projects.
- Decision: the CLI calls `POST /api/projects/add {root}` on the hub (same-origin check skipped only for `localhost` callers with header `x-vibedoc-cli: 1`; keep it local-only). The route goes through core like every write. Reply `{id}` → open `/?project=<id>`.
- A port taken by another program → next free port, saved, ⚠ block (R080 behaviour kept).
- Pinned `--port N` that a hub already uses → reuse it; taken by something else → exit 1 (unchanged).

## Scope
- [ ] `bin/address.mjs`: `resolveAddress` returns `{running: port}` for any hub; `addToHub(port, root)` (fetch, 3 s timeout)
- [ ] `bin/vibedoc.mjs`: running → add → print banner for that project → open → exit 0
- [ ] `src/app/api/projects/add/route.ts` — new; core `addHubProject(root)` refuses a non-directory; `emitUpdate("projects_updated")` so open tabs show the new project
- [ ] Update `e2e/stable-address.mjs` to the hub model

**Out of scope:** adding from the UI (T536).

## Files
- `bin/address.mjs` (+ check), `bin/vibedoc.mjs`
- `src/app/api/projects/add/route.ts` — new
- `src/lib/core.ts`
- `e2e/stable-address.mjs`

## Acceptance criteria
- [ ] `vibedoc` in repo A, then in repo B: one server process (e2e counts `next start` children), both projects in `/api/projects`, browser target is B (epic Done when)
- [ ] An open tab on A shows B in the switcher without a reload (SSE `projects_updated`)
- [ ] `POST /api/projects/add` from a non-localhost origin → 403
- [ ] `e2e/stable-address.mjs` passes

## Manual tests
- [ ] S2 — WHEN VibeDoc is already running and the user runs `npx vibedoc` in another repo → THEN no second VibeDoc starts and the browser opens that repo in the running one

## Verify
```bash
node bin/address.check.mts
pnpm lint && pnpm build
node e2e/stable-address.mjs
```
