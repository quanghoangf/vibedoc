# T360: Agent-only / human-only blocks in agent reads
**Status:** ✅ Done
**Owner:** ai:claude-code
**Done:** 2026-10-07
**Phase:** R087 — Agent-ready docs
**Size:** M (2–3 hrs)
**Depends on:** —
**Covers:** S2

## Goal
A doc can carry notes only an agent sees (`<!-- agent-only … -->`) and blocks only humans see (`<!-- human-only:start -->…<!-- human-only:end -->`); every agent read of a doc gets the agent view.

## Context
- Epic: `plans/roadmap/R087-agent-ready-docs.md`
- Pure libs never import values from each other; `node src/lib/<x>.check.mts` runs them without a bundler (MEMORY.md).
- The human view needs no code: react-markdown doesn't render raw HTML, so comments (markers and agent-only notes) are invisible in the viewer. Don't touch `MarkdownRenderer.tsx`.

## Scope
- [ ] `src/lib/audience.ts`: `forAgent(md)` — unwrap each `<!-- agent-only … -->` comment to its inner text, drop `<!-- human-only:start -->` … `<!-- human-only:end -->` (markers included; an unclosed start drops to end of file); markers inside ``` / ~~~ fences are left alone.
- [ ] `src/lib/audience.check.mts`: unwrap, drop, fenced markers untouched, unclosed start, two adjacent blocks, single-line and multi-line agent-only.
- [ ] Apply `forAgent` in the `vibedoc_read_doc` handler (`src/app/api/mcp/route.ts`) and in `getContext()` (`src/lib/core.ts`), not inside `readDoc` (the editor and `/api/docs?read=` keep the raw file).

**Out of scope:** `/md/` route (T361), editor toolbar inserts and Copy page (T365).

## Files
- `src/lib/audience.ts` — new
- `src/lib/audience.check.mts` — new
- `src/app/api/mcp/route.ts` — `vibedoc_read_doc` case
- `src/lib/core.ts` — `getContext()`
- `src/lib/mcp-tools.ts` — mention the blocks in `vibedoc_read_doc`'s description

## Implementation notes
- An agent that read the filtered doc can't `vibedoc_propose_edit` an `old_string` spanning a removed human-only block; editDoc already rejects a non-match and the agent retries. Note it in the tool description.

## Acceptance criteria
- [ ] `node src/lib/audience.check.mts` passes
- [ ] `vibedoc_read_doc` on a doc with both blocks shows the agent note and not the human-only text
- [ ] The doc viewer still shows the human-only text and no markers

## Verify
```bash
node src/lib/audience.check.mts
pnpm lint && pnpm build
```

## Manual tests
_2026-10-07 — ai_
### Steps
- [ ] S2 — In a doc add `<!-- agent-only Use pnpm. -->` and a `<!-- human-only:start -->…<!-- human-only:end -->` block, then ask the in-app agent to read it → it quotes "Use pnpm." and never the human-only text
- [ ] Open the same doc in /docs → the human-only text shows, no markers and no agent note are visible
### Regression risk
- [ ] A doc with an ordinary `<!-- comment -->` and code fences reads the same through the agent as before
