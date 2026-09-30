# ADR-005: Manual test checklist instead of a done gate

**Status:** ✅ Accepted
**Date:** 2026-09-30

## Context
R043 first aimed to count a task as done only after the agent attached verify output and a human approved it, so done on the board could be trusted. The agent both runs and reports its own verify commands, so that output is self-reported, and a mandatory approval step would make every /work-epic run wait on a person.

## Decision
After each task the agent writes a manual test report: a checklist of steps with expected results plus regression risks, stored in the task file as a ## Manual tests section. The card shows a 🧪 done/total badge and /manual-tests lists what is left to tick. Review is an optional status (approve → done, send back with a note → todo, recorded in ## Review). Nothing ever blocks moving a task to done.

## Rationale
A human-facing checklist adds the trust that self-reported verify output could not, without stopping the agent loop. Keeping the report in the task file means no new storage and it travels with the task in git.

## Alternatives considered
| Option | Why rejected |
|--------|-------------|
| Verify output attached to the task + mandatory approval before done | Rejected: the verify output is self-reported by the same agent, so it added no real trust, and a required approval blocks /work-epic on a human after every task. |
| Sidecar JSON per task for reports and ticks | Rejected: a second file per task to keep in sync; the markdown checklist is readable and diffable in the task file itself. |

## Consequences

