# T183: MCP vibedoc_list_specs / vibedoc_get_spec and the epic specs param
**Status:** 👀 Review
**Phase:** R066 — Living capability specs
**Size:** S (~1 hr)
**Depends on:** T181
**Owner:** ai:claude-code
**Due:** 2026-10-06
**Started:** 2026-10-05

## Goal
An agent can find and read specs on purpose (not only through Related spec), and can link an epic to its specs without editing the file by hand.

## Context
- Epic: `plans/roadmap/R066-living-capability-specs.md`.
- Hand-rolled JSON-RPC in `src/app/api/mcp/route.ts`: a tool = an entry in the tools list + a `case` in the switch. `/api/mcp` honours `?root=`.
- Specs are `docs/specs/<slug>.md` (T181). `listSpecs()` comes from T182; if T182 isn't merged yet, add it here and let T182 reuse it.

## Scope
- [ ] `vibedoc_list_specs` → one line per spec: slug, title, requirement count, scenario count.
- [ ] `vibedoc_get_spec { capability, requirement? }` → the full spec, or only one requirement with its scenarios; unknown slug → error listing the known slugs.
- [ ] `vibedoc_update_roadmap_item` accepts `specs: string[]` → writes/removes the `**Specs:**` meta line (unknown slugs are refused with the list).
- [ ] Docs: `docs/architecture/mcp-tools.md`, and the tool count in CLAUDE.md / DOMAIN_MAP / HLD / PRODUCT.md (they disagree today; set them all to the real count).

**Out of scope:** writing specs through MCP (agents use `vibedoc_propose_edit`, and `write_doc` stays as it is).

## Files
- `src/app/api/mcp/route.ts`, `src/lib/core.ts` (`updateRoadmapItem` patch `specs`)
- `docs/architecture/mcp-tools.md`, `CLAUDE.md`, `PRODUCT.md`, `docs/architecture/01-overview/DOMAIN_MAP.md`, `docs/architecture/02-high-level-design/HLD.md`

## Acceptance criteria
- [ ] `tools/list` includes both tools; `vibedoc_get_spec { capability: "board-views", requirement: "<name>" }` returns just that requirement.
- [ ] `vibedoc_update_roadmap_item { id: "R066", specs: ["board-views"] }` writes `**Specs:** board-views` and nothing else in the file changes.
- [ ] All docs state the same tool count.

## Verify
```bash
pnpm lint && pnpm build
curl -s localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vibedoc_list_specs","arguments":{}}}'
```

## Manual tests
_2026-10-05 — ai_
### Steps
- [ ] With a docs/specs/board-views.md in the project, ask an agent to call vibedoc_list_specs → one line "board-views · <title> · N requirements · M scenarios"
- [ ] vibedoc_get_spec { capability: "board-views", requirement: "<one requirement name>" } → only that requirement and its scenarios come back
- [ ] vibedoc_get_spec { capability: "nope" } → an error that lists the known spec slugs
- [ ] vibedoc_update_roadmap_item { id: "<epic>", specs: ["board-views"] } → the epic file gains exactly one line `**Specs:** board-views`; `specs: []` removes it again
- [ ] vibedoc_update_roadmap_item with an unknown slug → refused, listing the known slugs, file unchanged
### Regression risk
- [ ] Editing an epic on /roadmap (title, status, due, priority) still saves, and leaves a `**Specs:**` line in place
