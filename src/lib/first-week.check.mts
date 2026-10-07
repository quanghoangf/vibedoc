// Self-check for src/lib/first-week.ts: `node src/lib/first-week.check.mts`
import assert from "node:assert/strict"
import { FIRST_WEEK_STEPS, firstWeek } from "./first-week.ts"

const none = Object.fromEntries(FIRST_WEEK_STEPS.map((id) => [id, false])) as Record<(typeof FIRST_WEEK_STEPS)[number], boolean>

const empty = firstWeek(none)
assert.equal(empty.done, 0)
assert.equal(empty.total, 6)
assert.equal(empty.next, "agent")
assert.deepEqual(empty.steps.map((s) => s.id), [...FIRST_WEEK_STEPS])

// next = the first unticked step in order, even when a later one is ticked
const some = firstWeek({ ...none, agent: true, roadmap: true, memory: true })
assert.equal(some.done, 3)
assert.equal(some.next, "breakdown")

const all = firstWeek(Object.fromEntries(FIRST_WEEK_STEPS.map((id) => [id, true])) as typeof none)
assert.equal(all.done, 6)
assert.equal(all.next, null)

console.log("first-week: ok")
