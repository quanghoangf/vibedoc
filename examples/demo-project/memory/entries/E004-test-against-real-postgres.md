# E004: Test access rules against real Postgres, not mocks
**Type:** preference
**Updated:** 2026-09-22
**By:** human

RLS policies (ADR-001) only run inside Postgres, so a mocked DB passes tests that leak data. Integration tests use a throwaway database per run.
