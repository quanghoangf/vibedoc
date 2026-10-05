---
title: Capability specs
description: Living requirements per capability, kept current by each epic's spec changes.
sidebar: { order: 4 }
---

A capability spec, `docs/specs/<capability>.md`, says what one part of the product does today, as requirements with WHEN/THEN scenarios:

```markdown
### Requirement: Session budget
Session start SHALL fit the memory budget.

#### Scenario: Many entries
- WHEN there are 200 entries
- THEN only what fits is listed
```

- **While building:** when an agent claims a task, it sees the related requirements (`## Related spec`) so it keeps them true.
- **While verifying:** [`vibedoc_verify_context`](/vibedoc/docs/tools/vibedoc_verify_context/) gives a reviewing agent the task's criteria, the epic, the spec and the diff; its findings (critical, major, minor) land in the task, and you send the real ones back.
- **When an epic changes behaviour,** its body says how under `## Spec changes`: ADDED, MODIFIED, REMOVED or RENAMED requirements. When the epic is done, a person clicks **Merge into capability spec** on its sheet and accepts one diff. Agents never edit specs directly.

Specs start with the first epic that touches a capability and grow with every epic after it. There is no need to write them for the whole codebase up front.
