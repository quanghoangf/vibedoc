# E005: Writes carry an op_id, the server dedupes
**Type:** gotcha
**Updated:** 2026-10-02
**By:** ai:claude-code

After a reconnect the client replays its pending writes. Every write sends a client-generated `op_id`, and `(list_id, op_id)` is unique, so a write that already landed is not applied twice. Found while testing T006; see docs/api/lists.md and E001.
