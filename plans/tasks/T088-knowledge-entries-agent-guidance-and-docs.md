# T088: Agent guidance + docs for knowledge entries
**Status:** 📋 Todo
**Phase:** R046 — Project knowledge entries
**Size:** S (~1 hr)
**Depends on:** T087

## Goal
Agents know when to save an entry and when to write the handoff, and the docs describe entries. Without this, agents keep putting durable facts into the handoff and the epic changes nothing in practice.

## Context
- Epic: `plans/roadmap/R046-project-knowledge-entries.md`
- T086 and T087 shipped `vibedoc_save_entry`, `vibedoc_delete_entry`, the `memory/entries/E*.md` files and the index at the end of `vibedoc_read_memory`.
- The rule to teach: **a fact that should still be true next week goes in an entry. What happened this session goes in the handoff.**
- CLAUDE.md lists every file VibeDoc writes into the target project ("VibeDoc writes only …"). `memory/entries/*.md` must be added there.

## Scope
- [ ] `src/app/api/mcp/route.ts`: in the `vibedoc_update_memory` description, add that durable facts (conventions, gotchas, decisions, preferences) go to `vibedoc_save_entry`, not the handoff. Change no behavior
- [ ] `src/components/settings/SkillsSettings.tsx`: add `vibedoc_save_entry` and `vibedoc_delete_entry` to `AVAILABLE_TOOLS`
- [ ] `src/components/memory/MemoryTab.tsx`: in the agent-workflow hint (around line 34), add one line about saving durable facts with `vibedoc_save_entry`
- [ ] Docs, listed under Files

**Out of scope:** any behavior change. Seeding entries from this repo's `MEMORY.md`. The Memory tab UI for entries (R047).

## Files
- `src/app/api/mcp/route.ts`: the `vibedoc_update_memory` description only
- `src/components/settings/SkillsSettings.tsx`: `AVAILABLE_TOOLS`
- `src/components/memory/MemoryTab.tsx`: the hint text
- `docs/architecture/03-services/mcp-server/TOOLS.md`: sections for `vibedoc_save_entry` and `vibedoc_delete_entry`, in the same format as `vibedoc_read_memory`. Note there that `vibedoc_read_memory` now ends with the entry index
- `docs/architecture/mcp-tools.md`: the tool list, plus step 5 of the recommended workflow ("save durable facts as entries, then write the handoff")
- `docs/architecture/02-high-level-design/HLD.md`: the "AI starts a session" diagram notes and the `core.ts` responsibilities list (`listEntries` / `getEntry` / `saveEntry` / `deleteEntry`)
- `docs/architecture/01-overview/DOMAIN_MAP.md`: a "Knowledge entries" row in the Data ownership table (`memory/entries/E*.md`, Markdown with a `**Key:** Value` block)
- `CLAUDE.md`: add `memory/entries/*.md` to the "VibeDoc writes only …" list
- `README.md`: the MCP tools table (around line 109) and the session workflow list (around line 185)

## Implementation notes
- Keep the tool description change to one sentence. It is sent to every agent on every `tools/list`.
- Update the `**Last updated:**` line in each doc you touch to today's date.

## Acceptance criteria
- [ ] `tools/list` shows the new sentence in the `vibedoc_update_memory` description
- [ ] The Settings → Skills tool picker offers `vibedoc_save_entry` and `vibedoc_delete_entry`
- [ ] Every file listed under Files mentions entries, and `grep -rn "vibedoc_save_entry" docs README.md CLAUDE.md` finds each doc

## Verify
```bash
pnpm build && pnpm lint   # no new lint errors beyond the 16 pre-existing react-hooks ones
curl -s localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -o 'vibedoc_save_entry[^"]*' | head
grep -rln "vibedoc_save_entry" docs README.md CLAUDE.md src/components
```
