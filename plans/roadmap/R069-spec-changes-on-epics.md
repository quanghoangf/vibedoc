# R069: Spec changes on epics
**Parent:** R003
**Status:** in-progress
**Order:** 120
**Tasks:** T194, T195, T196, T197

An epic says how it changes a capability (added, modified and removed requirements) and, when it is done, VibeDoc proposes merging that change into the living spec, so specs stay current without anyone rewriting them (OpenSpec's delta + archive).

**In scope:** an optional spec-changes section on an epic for one or more capabilities; on done, a merge proposal shown as a diff the human accepts or edits; a warning when a done epic's spec change was never merged; the epic file stays as the record of why
**Out of scope:** automatic merges without review, resolving two open epics that change the same requirement beyond flagging it
**Done when:** finishing an epic that modifies one requirement produces a one-click diff, and accepting it updates the capability spec
