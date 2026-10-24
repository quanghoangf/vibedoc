// Self-check for src/lib/first-week.ts: `node src/lib/first-week.check.mts`
import assert from "node:assert/strict"
import { FIRST_WEEK_STEPS, firstWeek, stepAction } from "./first-week.ts"

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

// stepAction: real ids; the agent step is one link to Settings → Connect agent, never the CLI line
const ctx = { epicToBreakDown: "R002", epicToWork: "R005" }
assert.deepEqual(stepAction("agent", ctx), { href: "/settings?tab=connect" })
assert.equal(stepAction("breakdown", ctx).command, "/vibedoc:breakdown R002")
assert.equal(stepAction("taskDone", ctx).command, "/vibedoc:work R005")
assert.equal(stepAction("breakdown", { ...ctx, epicToBreakDown: null }).command, "/vibedoc:breakdown")
assert.equal(stepAction("testRun", ctx).href, "/manual-tests")
for (const id of FIRST_WEEK_STEPS) {
  const a = stepAction(id, ctx)
  assert.ok(a.href || a.command, `${id} has an action`)
}

console.log("first-week: ok")
