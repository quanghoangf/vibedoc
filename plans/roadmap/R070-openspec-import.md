# R070: OpenSpec import
**Parent:** R004
**Status:** planned
**Order:** 100
**Tasks:** T198, T199, T200

A repo that already uses OpenSpec opens in VibeDoc with its changes on the board and its specs readable, giving OpenSpec users (a CLI with no UI) a visual home and VibeDoc a path into that community.

**In scope:** read `openspec/changes/*` as epics with their tasks, `openspec/specs/*` as capability specs, archived changes as done epics; preview before anything is written; repeat imports don't duplicate
**Out of scope:** writing back to `openspec/`, Spec Kit / Kiro formats (later, same approach), running OpenSpec's CLI
**Done when:** pointing VibeDoc at the OpenSpec repo itself shows its open changes as epics with tasks and its specs in /docs
