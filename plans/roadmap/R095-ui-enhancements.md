# R095: UI enhancements
**Parent:** R002
**Status:** planned
**Order:** 360
**Tasks:** T504, T505, T506, T507, T508

Small fixes to layout and behaviour that make daily use smoother. Each task is one self-contained polish item found while using VibeDoc.

**In scope:** layout, scrolling, spacing and interaction fixes on existing pages
**Out of scope:** new features, new pages, redesigns
**Done when:** every listed enhancement ships with its check, and nothing else on the page moves

## Scenarios
### S1: Docs explorer scrolls on its own
- WHEN a long doc is open on /docs and the user scrolls the doc
- THEN the docs explorer on the left stays in place at full viewport height, and scrolling inside the explorer moves only the explorer
### S2: Task and epic properties in /docs
- WHEN a task or epic file is opened in /docs
- THEN its `**Key:** Value` meta lines show as property rows (status, phase, owner, dates…) instead of one plain-text paragraph, and status / owner / size / priority / due are editable like on the board
### S3: Linked docs without duplicates
- WHEN a doc both links to and is linked from the same items
- THEN the Linked docs panel lists each item once, marked with the direction(s) it links
### S4: From a task doc to its manual tests
- WHEN a task doc with manual tests is open in /docs
- THEN its test state shows on the page and one click opens that task in Test review
### S5: Epic pane left, task detail beside it
- WHEN the user opens an epic on /roadmap and clicks one of its tasks
- THEN the epic stays in a pane on the left and the task's detail fills the rest of the screen, like Test review's list · detail
