# R097: Diagrams from project data
**Parent:** R002
**Status:** in-progress
**Order:** 380
**Tasks:** T520, T521, T522, T523

VibeDoc already knows how the work fits together — task dependencies, which tasks an epic holds, which scenarios they cover, how docs link — but shows it as meta lines to read. Draw it, derived on read and never stored, and give agents the same picture as text.

**In scope:** a dependency diagram on a task (upstream and downstream, each with its status, clickable); an epic diagram (epic → tasks with status, and which scenarios each task covers, passed / failed / unproven); a small in/out link graph on a doc; the same structure as compact text for agents in `vibedoc_get_task`, `vibedoc_get_roadmap` and `vibedoc_read_doc`; styled like R096's themed diagrams
**Out of scope:** hand-editing these diagrams, cross-project diagrams, replacing /graph or the roadmap map
**Done when:** opening a task, an epic and a doc shows a diagram of its dependencies / tasks + coverage / links that updates live, and an agent gets the same relationships as text from MCP

## Scenarios
### S1: Task dependencies
- WHEN a task has `Depends on` and dependents
- THEN its panel and doc show a diagram of both sides with each task's status, and clicking a node opens that task
### S2: Epic at a glance
- WHEN an epic with tasks and scenarios is opened
- THEN a diagram shows its tasks with status and which scenario each covers, coloured passed / failed / unproven
### S3: Doc links
- WHEN a doc is opened
- THEN a small graph shows the docs linking to it and the docs it links to
### S4: Live
- WHEN a task changes status while its diagram is open
- THEN the diagram updates without a reload
### S5: Agents see the same
- WHEN an agent calls `vibedoc_get_task` or `vibedoc_get_roadmap`
- THEN the reply includes the dependency / coverage structure as compact text
