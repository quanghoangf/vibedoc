# E003: Timestamps are UTC in the database; only the browser converts
**Type:** gotcha
**Updated:** 2026-09-30
**By:** human

The first reminder prototype stored local times and fired an hour off after a DST change. Use `timestamptz` and ISO strings with `Z`. Matters for T009.
