# R051: Memory cleanup & staleness
**Parent:** R004
**Status:** done
**Order:** 50
**Tasks:** T117, T118, T119, T120, T121, T122

Memory stays trustworthy as it grows: memory that is stale, duplicated or contradicting gets flagged before it misleads an agent. Based on agentmemory's decay and contradiction handling.

**In scope:** flag memory that contradicts the board or roadmap (e.g. "working on T055" when T055 is done); spot duplicate and conflicting entries; show entries nobody has recalled in a long time; suggest merges and removals for a person to approve
**Out of scope:** deleting anything without approval
**Done when:** a handoff that names a finished task as in progress shows a warning, and approving a suggested merge leaves one entry
