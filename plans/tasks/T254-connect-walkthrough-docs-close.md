# T254: Connect walkthrough end to end, docs, close R081
**Status:** 📋 Todo
**Phase:** R081 — Connect your agent
**Size:** S (~1 hr)
**Depends on:** T251, T252, T253
**Covers:** S1, S2, S3, S4

## Goal
Prove the epic's flow end to end on a fresh project and point the docs at the panel instead of the README's manual steps.

## Context
- Epic: `plans/roadmap/R081-connect-your-agent.md`. Done when: on a fresh project, a Claude Code user goes from `npx vibedoc` to ✓ on both steps without opening the README.
- **Dependency outside this epic:** `bin/vibedoc.mjs` opens `/setup` (the template wizard). The panel is mounted on the first screen by R082 (welcome screen) and the port becomes stable in R080. Until R082 lands, the panel is reached via Settings → Connect agent (`/settings?tab=connect`). This task proves the panel flow; the "first screen" half of Done-when needs R082.
- `e2e/connect-agent.mjs` grew task by task; this task makes it one clean pass from a fresh fixture.

## Scope
- [ ] `e2e/connect-agent.mjs`: fresh fixture → `/settings?tab=connect` → Connect (confirm) → MCP ✓ after a `tools/call` → Install skills → ✓ + `/vibedoc:roadmap`; Cursor path; phone width has no horizontal scroll
- [ ] Docs: `docs/getting-started.md` and the README connect section say "open Settings → Connect agent" first, the commands stay as the fallback; site docs page that covers connecting (find it under `site/src/content/docs/`); `memory/MEMORY.md` Key conventions — one line (evidence file, tools/call only, `claude-cli.ts`, seam for R082/R084, `?tab=connect`)
- [ ] Set R081 `**Status:** done` once every task is done

**Out of scope:** the welcome screen (R082), stable port (R080).

## Files
- `e2e/connect-agent.mjs`, `README.md`, `docs/getting-started.md`, `site/src/content/docs/…`, `memory/MEMORY.md`, `plans/roadmap/R081-connect-your-agent.md`

## Acceptance criteria
- [ ] The e2e runs clean in one pass from a fresh fixture
- [ ] Docs point to the panel; `pnpm --dir site test` passes if site docs changed
- [ ] Epic status done

## Verify
```bash
pnpm lint && pnpm build
PATH=$PWD/e2e/fixtures/claude-stub:$PATH PORT=3081 pnpm dev:next &
BASE=http://localhost:3081 node e2e/connect-agent.mjs
```

## Manual tests
- [ ] S1 — WHEN the user clicks Connect for Claude Code and confirms → THEN VibeDoc is added to Claude Code's MCP servers and the step says what was changed
- [ ] S2 — WHEN the connected agent makes its first VibeDoc call → THEN the MCP step turns ✓ without a reload
- [ ] S3 — WHEN the vibedoc plugin is installed in Claude Code → THEN the skills step shows ✓ and lists `/vibedoc:roadmap` as the next thing to try
- [ ] S4 — WHEN the user picks Cursor or "Other" → THEN they get the config to paste, and the MCP step still turns ✓ on the first call
