# R049: Private content guard
**Parent:** R003
**Status:** planned
**Order:** 60
**Tasks:** —

Secrets and anything the user marks private never get written to memory. This has to ship before memory is written automatically (R050).

**In scope:** content inside <private> tags is left out; common secret patterns (API keys, tokens, passwords) are blocked or masked; the agent is told when something was left out
**Out of scope:** encrypting memory at rest; access control per person
**Done when:** a handoff or entry that contains a <private> block or an API key is saved without it
