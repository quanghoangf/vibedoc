# T009: Reminder scheduler
**Status:** 📋 Todo
**Phase:** R005 — Reminders
**Size:** M
**Depends on:** —
**Due:** 2026-10-09

## Goal
Items can have a remind-at time; a worker fires reminders on time.

## Context
- Store times in UTC, convert only in the client (E003)

## Acceptance criteria
- [ ] Reminders fire within 1 minute of their time
- [ ] A missed run catches up without double-sending
