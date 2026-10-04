# T128: Entry source line + Claude Code memory reader
**Status:** ✅ Done
**Phase:** R052 — Cross-agent memory
**Size:** M
**Depends on:** —

## Goal
Knowledge entries can record where they came from (`**Source:** claude-code:<name>`), and VibeDoc can read the current project's Claude Code memory files into a list of entry candidates. The import tool (T129) and the export (T130) build on both.

## Context
- Epic: `plans/roadmap/R052-cross-agent-memory.md`
- Decided (interview): this epic imports **Claude Code only**. Cursor and Cline importers, a UI for import, and live two-way sync are out.
- Decided: Claude Code memory is read **read-only from a fixed path**: `<config>/projects/<slug>/memory/*.md`, where `<config>` is `$CLAUDE_CONFIG_DIR` if set, else `~/.claude`, and `<slug>` is the absolute `VIBEDOC_ROOT` with every non-alphanumeric character replaced by `-` (`/Users/x/work/vibedoc` → `-Users-x-work-vibedoc`). VibeDoc never writes there, and the caller can't pass any other path.
- Decided: provenance is a `**Source:**` meta line on the entry: `claude-code:<name>` (the memory's `name:` slug). Don't store the absolute home path, because entries are committed to git.
- Entry format and helpers: `src/lib/entries.ts` (T086). The meta block is contiguous `**Key:** Value` lines under the H1, with no blank lines inside it.
- Project rules (CLAUDE.md): only `src/lib/core.ts` touches the file system. Pure logic goes in `src/lib/*.ts` with a `*.check.mts` self-check.

## Scope
- [x] `entries.ts`: optional `source?: string` on `Entry` and `EntryInput`. `parseEntry` reads `**Source:**`, and `formatEntry` writes it after `**Updated:**` only when it is set
- [x] `saveEntry()` in `core.ts` accepts `source`. An update without `source` keeps the existing one
- [x] `vibedoc_get_entries` output shows the `Source:` line when an entry has one
- [x] `src/lib/claude-memory.ts` (new, pure): `claudeProjectSlug(root)`, `parseClaudeMemory(raw, file)` and `mapClaudeType(t)`
- [x] `src/lib/claude-memory.check.mts` (new)
- [x] `core.ts`: `claudeMemoryDir(root)` and `readClaudeMemory(root)` return the parsed candidates; a missing folder returns `[]`

**Out of scope:** the MCP import tool, dedupe and writing entries (T129). Export (T130). Docs (T131). `vibedoc_save_entry` does not get a `source` argument, since agents don't set it by hand.

## Files
- `src/lib/entries.ts`, `src/lib/entries.check.mts`: add `source`
- `src/lib/claude-memory.ts`, `src/lib/claude-memory.check.mts`: new
- `src/lib/core.ts`: `claudeMemoryDir()` and `readClaudeMemory()` in the knowledge-entries section; `saveEntry()` passes `source` through
- `src/app/api/mcp/route.ts`: the `vibedoc_get_entries` formatter

## Implementation notes
Claude Code memory file (one fact per file, plus a `MEMORY.md` index that you **skip**):
```md
---
name: only-core-touches-fs
description: API routes import from core.ts, never fs
metadata:
  type: feedback
---
<body>
```
Older files may have `type:` at the top level instead of under `metadata:`; accept both. Parse the frontmatter with a small line-based reader (only `name`, `description`, `type`), not a new YAML dependency.

```ts
export type ClaudeMemoryCandidate = { name: string; type: EntryType; summary: string; body: string; file: string }
export function claudeProjectSlug(absRoot: string): string
export function parseClaudeMemory(raw: string, file: string): ClaudeMemoryCandidate | null // null without name or description
export function mapClaudeType(t: string | undefined): EntryType
```
Type map: `feedback` → `preference`, `user` → `preference`, `project` → `decision`, `reference` → `convention`, anything else → `convention`. Summary = `description` on one line, cut to 120 chars, so it passes `validateEntryInput`.

## Acceptance criteria
- [x] An entry with `**Source:**` survives a parse → format round trip; an entry without one formats exactly as before (no diff on existing files)
- [x] Updating an imported entry through `vibedoc_save_entry` keeps its `**Source:**` line
- [x] `readClaudeMemory()` returns `[]` when the folder is missing, skips `MEMORY.md` and unparsable files, and never writes anything
- [x] The check covers: slug of a path with `/`, `.` and spaces; both frontmatter shapes; each type mapping; a long or multi-line description; a file without frontmatter → null

## Verify
```bash
node src/lib/entries.check.mts && node src/lib/claude-memory.check.mts
pnpm lint && pnpm build
```
