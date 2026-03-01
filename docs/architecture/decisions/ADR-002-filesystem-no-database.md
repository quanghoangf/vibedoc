# ADR-002: File System as Source of Truth (No Database)
**Status:** ✅ Accepted
**Date:** 2025-02-28

## Context
VibeDoc needs to store tasks, docs, memory, and activity. Options: database (SQLite/PostgreSQL), flat files, or read from existing project files.

## Decision
**Read and write the target project's actual files.** No database. Tasks live in `plans/tasks/*.md`. Memory lives in `memory/MEMORY.md`. Activity log is `.vibedoc-activity.json`.

## Rationale
- Zero setup — works with any project that has the right folder structure
- Files are in git — task status changes are tracked, reviewable, diffable
- AI agents can read/write the same files directly without going through VibeDoc
- No data to migrate, backup, or sync
- Teams using git already have the collaboration layer

## Alternatives considered
| Option | Why rejected |
|--------|-------------|
| SQLite | Extra setup, data not in git, import/export complexity |
| PostgreSQL | Way too heavy for a local dev tool |
| JSON files (custom format) | Markdown is more readable, works with existing vibedoc-generator |

## Consequences
- No complex queries — all filtering is in-memory after file reads
- Performance OK for typical project (< 100 tasks, < 200 docs) — glob + fs.readFile is fast enough
- Large projects (1000+ docs) may feel slow on search — will need caching layer if this becomes an issue
- `.vibedoc-activity.json` is the only non-markdown file VibeDoc creates
