# T092: "Changed by" on entries + e2e for the Memory browser + docs
**Status:** 📋 Todo
**Phase:** R047 — Memory browser
**Size:** M (2–3 hrs)
**Depends on:** T091

## Goal
Each entry shows who changed it last, a person or a named agent, so a user can tell a hand-fixed fact from one an agent wrote. A browser test proves the epic's Done-when end to end, and the docs describe the Memory browser.

## Context
- Epic: `plans/roadmap/R047-memory-browser.md`. Done when: a user finds a wrong entry through search, fixes or deletes it in the Memory tab, and the next agent session sees the change.
- Decided: the author lives in the entry file as a `**By:**` line under `**Updated:**`: `human` or `ai:<agent>`. It survives the 2000-event activity cap and shows in git. Don't read it from the activity log.
- Reuse `src/lib/owner.ts` (`parseOwner`, `ownerKind`, `ownerLabel`) and `OwnerChip` (`src/components/shared/OwnerChip.tsx`). The values are the same shape as task owners.
- The MCP route already knows the calling agent: `args.agent`, else `agentFromUserAgent(req.headers.get("user-agent"))` from `src/lib/owner.ts`. The route computes this `agent` for task claims (`src/app/api/mcp/route.ts`, the `handleTool` call).
- Older entry files have no `**By:**` line. They show no chip.

## Scope
- [ ] `src/lib/entries.ts`: `Entry.by: string | null`. Parse and format `**By:**`. Update `entries.check.mts`
- [ ] `core.ts` `saveEntry(input, root, actor, agent?)`: write `by` = `human` for a human save, `ai:<agent>` for an agent save (`ai:agent` when the name is unknown)
- [ ] `/api/mcp` `vibedoc_save_entry`: pass the agent. `/api/memory/entries/save`: `human`
- [ ] UI: `OwnerChip` on each list row and a "Changed by" property in the `EntryDetail` header
- [ ] `e2e/memory-browser.mjs` (new): the Done-when flow
- [ ] Docs: the Memory tab in README and HLD, and `**By:**` in the entry format in `docs/architecture/03-services/mcp-server/TOOLS.md`

**Out of scope:** changing restore (T091 writes the raw file back, with its original `**By:**`). Showing the author in `vibedoc_recall` or `vibedoc_read_memory` output (the token budget matters more there).

## Files
- `src/lib/entries.ts`, `src/lib/entries.check.mts`
- `src/lib/core.ts`: `saveEntry`
- `src/app/api/mcp/route.ts`: the `vibedoc_save_entry` case. `src/app/api/memory/entries/save/route.ts`
- `src/components/memory/EntryList.tsx`, `src/components/memory/EntryDetail.tsx`
- `e2e/memory-browser.mjs`: new. Copy the setup of `e2e/manual-tests-review.mjs` (`makeFixture`, `launchChrome` from `e2e/stub-chat.mjs`, a real `/api/mcp` call with `?root=` the fixture)
- `README.md`, `docs/architecture/02-high-level-design/HLD.md`, `docs/architecture/03-services/mcp-server/TOOLS.md`

## Implementation notes
- Keep the meta block contiguous: `**Type:**`, `**Updated:**`, then `**By:**`. `parseEntry` already reads any `**Key:**` line in that block, so the new field costs one line there. `formatEntry` writes `**By:**` only when `by` is set.
- `saveEntry` signature: add `agent?: string` as the last parameter, so existing callers still compile.
- The e2e flow, on a fixture with three entries (one of them wrong):
  1. Open `/memory?root=<fixture>`, type a word from the wrong entry → it is the first row
  2. Open it, Edit, fix the summary, Save → the row shows the new summary and a person chip
  3. Call `vibedoc_read_memory` through `/api/mcp` → the fixed summary is in the reply
  4. Delete another entry → Undo → it is back. Delete it again → `vibedoc_read_memory` no longer lists it
  5. Fail on any browser console error, like the other e2e files

## Acceptance criteria
- [ ] Saving from the Memory tab writes `**By:** human`. Saving through MCP writes `**By:** ai:<agent>`
- [ ] Rows and the detail header show the chip. Old entries without `**By:**` show none
- [ ] `entries.check.mts` covers a round trip with and without `**By:**`
- [ ] `e2e/memory-browser.mjs` passes against `pnpm dev`
- [ ] README, HLD and TOOLS.md describe the Memory browser and the `**By:**` line

## Verify
```bash
node src/lib/entries.check.mts
pnpm typecheck && pnpm build && pnpm lint   # no new lint errors beyond the 14 pre-existing ones
PW_DIR=<dir with node_modules/playwright> node e2e/memory-browser.mjs   # with pnpm dev running
```
