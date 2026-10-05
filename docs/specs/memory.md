# Project memory

## Purpose
Project memory carries what agents and people learned from one session to the next. It has two parts: the session handoff in `memory/MEMORY.md`, and knowledge entries, one durable fact per file in `memory/entries/`. Agents read and write it through MCP tools; people browse, fix and restore it on the Memory tab.

## Requirements

### Requirement: Session start shows the handoff and the entry index
`vibedoc_read_memory` SHALL return the handoff followed by an index of the knowledge entries, one compact line each (id, type, summary, rough token cost), never the entry bodies.

#### Scenario: A fact saved in one session reaches the next
- WHEN an agent saves a convention with `vibedoc_save_entry` in one session
- THEN the next session's `vibedoc_read_memory` lists that entry's index line, without anyone adding it to the handoff

#### Scenario: No entries yet
- WHEN the project has no knowledge entries
- THEN `vibedoc_read_memory` still returns the handoff and shows `## Knowledge entries (0)` with a hint to save one

### Requirement: Session start stays inside a token budget
The session-start reply SHALL fit the project's memory budget (2000 tokens unless the project sets another), listing the newest entries that fit and pointing to `vibedoc_recall` for the rest.

#### Scenario: Many entries
- WHEN the project has 200 or more entries
- THEN `vibedoc_read_memory` lists only as many index lines as fit the budget and ends with a "+N more" line that names `vibedoc_recall`

#### Scenario: Few entries
- WHEN every entry fits the budget
- THEN all of them are listed and there is no "+N more" line

### Requirement: One fact per entry
An agent or a person SHALL be able to create, update and delete a knowledge entry, where each entry has an id (`E001`, `E002`, …), a type (convention, gotcha, decision or preference), a one-line summary and a body.

#### Scenario: Create, then update
- WHEN an agent calls `vibedoc_save_entry` without an id, and later with `id: "E001"` and a new summary
- THEN the first call creates the next free id, and the second updates that entry and its file name follows the new summary

#### Scenario: Invalid input
- WHEN the type is unknown, the summary is empty or spans several lines, or the id does not exist
- THEN the call returns a clear error and nothing is written

#### Scenario: Who changed it
- WHEN an entry is saved from the Memory tab, or by an agent through MCP
- THEN the entry shows "human", or the agent's name, as the last one who changed it

### Requirement: Recall by keyword, bodies on request
`vibedoc_recall` SHALL return a short ranked list of matching entries as compact lines, and `vibedoc_get_entries` SHALL return the full entries for up to 20 ids.

#### Scenario: Topic search
- WHEN an agent recalls "sse events" and an entry about the SSE bus exists
- THEN that entry is first in the list, and no bodies are in the reply

#### Scenario: Fetch bodies
- WHEN an agent asks for two known ids and one unknown id
- THEN both known entries come back in the order asked, and the unknown id is listed as not found

### Requirement: Related memory on a task
Opening or claiming a task SHALL end with up to three related entries as compact lines, only when they match the task strongly.

#### Scenario: A related convention exists
- WHEN an agent claims a task titled "SSE reconnect on project switch" and an SSE entry exists
- THEN the reply ends with `## Related memory` listing that entry

#### Scenario: Nothing related
- WHEN no entry matches the task
- THEN the reply has no `## Related memory` block

### Requirement: Handoff updates keep other sections
`vibedoc_update_memory` SHALL rewrite only the handoff sections it is given and leave every other section of MEMORY.md as it was, including hand-written ones.

#### Scenario: A hand-written section survives
- WHEN MEMORY.md has a hand-written "Key conventions" section and an agent updates only the handoff
- THEN the handoff and the last-updated date change and every other line stays the same

#### Scenario: Nothing to update
- WHEN an agent calls `vibedoc_update_memory` with no sections
- THEN it gets an error and MEMORY.md is unchanged

### Requirement: Earlier handoffs can be restored
Every write to MEMORY.md SHALL first keep the version it replaces (the 20 newest are kept), and an agent or a person SHALL be able to restore one.

#### Scenario: Agent restores a clobbered handoff
- WHEN an agent lists the versions with `vibedoc_memory_history` and restores one
- THEN the next `vibedoc_read_memory` shows the restored handoff

#### Scenario: Person restores on the Memory tab, then undoes
- WHEN a person opens History on /memory, picks an older version and clicks Restore
- THEN the diff shows what changed, the old handoff shows without a reload, and Undo brings the newer one back

### Requirement: Browse, search and fix entries on the Memory tab
The Memory tab SHALL list every entry next to the handoff, with search ranked like `vibedoc_recall`, type filters, a detail view that can be edited, New entry, and Delete with Undo.

#### Scenario: Find and fix a wrong entry
- WHEN a person searches, opens an entry (the URL becomes `/memory?entry=E012`), edits its summary and saves
- THEN the list and detail update, and the next agent session sees the new summary

#### Scenario: Delete with Undo
- WHEN a person deletes an entry and clicks Undo in the toast
- THEN the same entry comes back with the same id and text

#### Scenario: Live updates
- WHEN an agent saves an entry while the Memory tab is open
- THEN the list shows it without a reload

### Requirement: Entries show what they relate to
An entry SHALL show the tasks, epics, ADRs, docs and entries it mentions ("Links to") and those that mention it ("Linked from"), on the Memory tab, in a graph view and in `vibedoc_get_entries`.

#### Scenario: Links from the text
- WHEN an entry's body mentions a task id and a doc path, and a task file mentions the entry's id
- THEN the entry lists the task and the doc under "Links to" and the task under "Linked from", and each row opens that item

#### Scenario: Graph view
- WHEN a person switches the Memory tab to Graph and selects an entry
- THEN its neighbours are highlighted, and entries with no links are muted

### Requirement: Entry history
An entry SHALL show each commit that changed it (date, author, message) and its text at that commit, when the project is a git repository.

#### Scenario: Not a git repository
- WHEN the project is not a git repository
- THEN the history section says it needs git instead of showing an error
