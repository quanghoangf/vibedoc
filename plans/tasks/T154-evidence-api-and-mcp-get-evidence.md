# T154: Evidence API + MCP vibedoc_get_evidence
**Status:** ✅ Done
**Phase:** R060 — Evidence report per task
**Size:** M (2–3 hrs)
**Depends on:** T153
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
The VibeDoc UI and agents can read a task's evidence: the same doc as `EVIDENCE.md`, generated fresh from the current checklist (with ticks done since the run) and the kept runs.

## Context
- Epic: `plans/roadmap/R060-evidence-report-per-task.md`
- Formatter: `formatEvidence` / `matchItems` in `src/lib/evidence.ts` (T153). Core formats on read and **never writes** `EVIDENCE.md`. The fixture owns that file.
- CLAUDE.md: only `src/lib/core.ts` touches fs, and routes stay thin. GETs need no `emitUpdate`.
- R062 (later) wants agents to see the failing step. The MCP output is text: steps, results and errors, plus screenshot **file paths** instead of images.

## Scope
- [ ] `core.ts`: `getEvidence(taskId, root, { runId?, src? })` → `{ markdown, runs: { runId, status, startedAt, commit }[], runId: string | null }`. It uses `getTask` for the title and checklist, and `listRuns` for the runs. An unknown `runId` → null (route 404). Demo → no runs, which is still a valid doc.
- [ ] `GET /api/tasks/[id]/evidence?run=<runId>` → that JSON. Image `src` = `/api/tasks/<id>/runs/<runId>/<file>` plus the root param, so the UI can render the markdown as is. Validate `run` with `isRunId` before use.
- [ ] MCP `vibedoc_get_evidence { taskId, runId? }`. Returns the markdown with `src` = absolute file paths on disk, so an agent with file access can open a screenshot. Add it to the demo allowlist (read-only) and to `docs/architecture/mcp-tools.md`.
- [ ] Bump the tool count in `docs/architecture/02-high-level-design/HLD.md` / `DOMAIN_MAP.md` if they state it.

**Out of scope:** the UI (T155), entry points (T156), and writing `EVIDENCE.md` from the server.

## Files
- `src/lib/core.ts`: `getEvidence` next to `listRuns` (~line 606). Reuse `taskRunsDir`.
- `src/app/api/tasks/[id]/evidence/route.ts`: new. Copy the shape of `src/app/api/tasks/[id]/runs/route.ts`.
- `src/app/api/mcp/route.ts`: tool definition plus case. Follow `vibedoc_get_task` (~line 239).
- `docs/architecture/mcp-tools.md`

## Implementation notes
- `rootParam` in the image URL: the UI passes `?root=` on every API call. Build the `src` callback in the route from the request's `root` search param, so images load for non-default projects.
- An empty checklist plus runs still produces a doc: all steps show as `extra`, under a heading like "Steps (not in the checklist)".

## Acceptance criteria
- [ ] `curl localhost:3000/api/tasks/T138/evidence | jq -r .markdown` shows every step with a screenshot URL that loads (200, image/png).
- [ ] `?run=<older runId>` details that run, and `?run=nope` returns 400.
- [ ] Ticking a manual item on /manual-tests, then refetching, shows it ☑ (formatted fresh, not from the file).
- [ ] MCP `vibedoc_get_evidence {taskId:"T138"}` returns the doc, and its screenshot paths exist on disk.
- [ ] A task with no runs → a doc saying there is no run yet, not an error.

## Verify
```bash
pnpm lint && pnpm build
curl -s localhost:3000/api/tasks/T138/evidence | jq -r .markdown | head -30
curl -s -o /dev/null -w '%{http_code}\n' 'localhost:3000/api/tasks/T138/evidence?run=nope'   # 400
<scratchpad>/mcp.sh vibedoc_get_evidence '{"taskId":"T138"}'
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Open http://localhost:3000/api/tasks/T138/evidence → JSON with `markdown`, `runId` and `runs` (newest first); the markdown's image links are `/api/tasks/T138/runs/<runId>/<file>.png` and open as images in the browser
- [ ] Add `?run=<the older runId from runs>` → the markdown's top line shows that run's time and commit, and its History row is marked shown; `?run=nope` → 400, `?run=20200101T000000Z` → 404
- [ ] Tick a manual item of a task on /manual-tests, then reload its evidence URL → that item reads ☑ … manual, ticked (fresh, not from EVIDENCE.md)
- [ ] Ask an agent (or the VibeDoc chat) to call `vibedoc_get_evidence` for T138 → it returns the doc, and the screenshot paths are absolute files under ~/.vibedoc/runs/vibedoc/T138/ that exist
- [ ] A task with no runs (e.g. /api/tasks/T153/evidence) → a doc reading "No run yet." with its checklist, not an error
### Regression risk
- [ ] With `?root=<another project>` the evidence image links keep the root param and still load
- [ ] Demo mode: `vibedoc_get_evidence` is allowed (read-only) and returns "No run yet."
