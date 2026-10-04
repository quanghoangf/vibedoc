# T133: Example project + demo deploy config
**Status:** ✅ Done
**Phase:** R042 — Demo & docs site
**Size:** M
**Depends on:** T132
**Owner:** ai:claude-code
**Due:** 2026-10-07
**Started:** 2026-10-04
**Done:** 2026-10-04

## Goal
A realistic example project ships in the repo, and one config deploys the demo: VibeDoc in demo mode pointed at that project, on a Node host.

## Context
- Epic: `plans/roadmap/R042-demo-and-docs-site.md`
- Decided: hosted read-only app on a Node host (SSE and file reads need a long-running process, not serverless).
- Depends on T1's `VIBEDOC_DEMO=1`.

## Scope
- [ ] `examples/demo-project/`: a small fictional app (e.g. a todo SaaS) with ~12 tasks across every status, 2 horizons with 3–4 epics, `layout.json`, a few docs with links (so the graph has content), `memory/MEMORY.md`, 3–4 knowledge entries, one ADR
- [ ] `npm run demo` script: `VIBEDOC_DEMO=1 VIBEDOC_ROOT=examples/demo-project next start` (after build)
- [ ] `Dockerfile` (and `fly.toml` or `render.yaml`, whichever is chosen) that builds and runs the demo
- [ ] Make sure `examples/` is excluded from the npm package (`files` in `package.json` or `.npmignore`)

**Out of scope:** landing and docs pages (T3), README links (T4).

## Files
- `examples/demo-project/**`: new
- `package.json`: `demo` script; check `files`
- `Dockerfile`, `fly.toml` / `render.yaml`: new

## Implementation notes
- Copy task and roadmap file formats from this repo's `plans/` (the meta block must stay contiguous under the H1, or the board parser drops fields).
- Fill in the `Owner`/`Started`/`Done`/`Due` lines so the roadmap shows progress and at-risk flags.

## Acceptance criteria
- [ ] `npm run build && npm run demo` shows a populated board, roadmap with progress, graph and memory
- [ ] Docker image builds and serves the demo on `$PORT`
- [ ] `npm pack --dry-run` does not include `examples/`

## Verify
```bash
npm run lint && npm run build && npm run demo
docker build -t vibedoc-demo . && docker run -p 3000:3000 vibedoc-demo
npm pack --dry-run | grep examples   # no output
```

## Manual tests
_2026-10-04 — ai_
### Steps
- [ ] Run `npm run build && PORT=3101 npm run demo` and open http://localhost:3101/board. Expect 12 Listly tasks spread over Todo, In-progress, Review, Blocked, Paused, Done and Cancelled, plus the read-only demo banner. Expect no create, move or edit controls to work.
- [ ] Open /roadmap. Expect two horizons ("Now — collaborative lists", "Next — never forget"). R003 should be fully done. R004 "Shared lists" and R005 "Reminders" should each carry an at-risk mark, and the Needs attention panel should list T005 overdue, T007 blocked and R005 with nothing started. The positions from layout.json should be used, not auto-placed.
- [ ] Open T006 "Live sync" on the board. Expect the 🧪 1/3 manual tests badge and the Review status.
- [ ] Open /graph. Expect the overview, lists API, sharing and ADR-001 docs linked to each other and to tasks T003–T009 and entries E002–E004. The `[[sharing]]` wikilink should resolve, and the toolbar should show no broken links.
- [ ] Open /memory. Expect 4 entries (convention, decision, gotcha, preference) and the handoff with Current state, Working on now and Active issues filled in.
- [ ] Run `docker build -t vibedoc-demo . && docker run -p 8080:3000 vibedoc-demo` and open http://localhost:8080/roadmap. Expect the same populated demo. Then run with `-e PORT=9000 -p 9000:9000` and confirm it still serves.
### Regression risk
- [ ] Run VibeDoc on its own repo (the :3000 dev server) and open /docs and /graph. listDocs and getDocGraph glob `**/*.md` from the project root, so the examples/demo-project docs, tasks and entries now appear as extra files. Their T001-style ids may resolve against VibeDoc's own tasks. Decide whether that clutter is acceptable or needs an ignore rule, which this task left out of scope.
- [ ] `npm pack --dry-run` should still list the same runtime files as before (bin, .next/server, .next/static, public, skills), with no examples/, Dockerfile or fly.toml.
