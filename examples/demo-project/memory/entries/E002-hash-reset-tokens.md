# E002: Store reset and invite tokens hashed, never in plain text
**Type:** decision
**Updated:** 2026-09-15
**By:** ai:claude-code

Password reset tokens (T002) are stored as SHA-256 hashes; the email carries the raw token. Invite tokens (T005) follow the same rule.
