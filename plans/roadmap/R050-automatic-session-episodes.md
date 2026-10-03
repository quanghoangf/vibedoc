# R050: Automatic session episodes
**Parent:** R003
**Status:** planned
**Order:** 70
**Tasks:** T113, T114, T115, T116

Every agent session leaves a summary and a handoff, even when the agent forgets to write one. Based on agentmemory's episodic memory, but built from VibeDoc's own activity log and session timeline.

**In scope:** a summary for each session built from its activity (tasks touched, docs edited, decisions); a handoff written when a chat or epic run ends; sessions that ended with no handoff are flagged; durable facts spotted in a session are suggested as knowledge entries for a person to accept
**Out of scope:** recording raw tool calls from outside VibeDoc; automatic cleanup (R051)
**Done when:** a chat that ends without calling the memory tool still leaves a readable session summary, and the next session starts from it
