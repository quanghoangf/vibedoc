# R048: Token-cheap recall
**Parent:** R003
**Status:** done
**Order:** 50
**Tasks:** T065, T066, T067, T068

Agents pull only the memory relevant to the current task, so memory can grow without filling the context window. Based on claude-mem's approach: show a short index first, fetch full entries only on request (about 10× fewer tokens).

**In scope:** recall by topic or keyword that returns a compact list first; fetch full entries by id; a token budget for what loads at session start; entries related to the task being claimed are suggested
**Out of scope:** vector or semantic search; knowledge graph (R053)
**Done when:** with 200+ entries, an agent's session start still stays inside the budget, and asking about a topic returns the right entry in the first compact list
