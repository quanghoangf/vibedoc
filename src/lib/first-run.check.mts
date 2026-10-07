// node src/lib/first-run.check.mts
import assert from "node:assert/strict"
import { EMPTY_FEEDBACK, STEPS, applyConsent, isStep, markSent, parseFeedback, pendingSteps, reachedSteps, stepUrl } from "./first-run.ts"

// parse: lenient, unknown steps dropped, order = funnel order
assert.deepEqual(parseFeedback(null), EMPTY_FEEDBACK)
assert.deepEqual(parseFeedback({ consent: "yes", sent: "x" }), { consent: null, sent: [] })
assert.deepEqual(parseFeedback({ consent: true, sent: ["first-roadmap", "bogus", "started"] }), { consent: true, sent: ["started", "first-roadmap"] })

// reached
const empty = { tasks: [], roadmap: [], activity: [] }
assert.deepEqual(reachedSteps(empty), ["started"])
assert.deepEqual(reachedSteps({
  tasks: [{ status: "todo" }, { status: "done" }],
  roadmap: [{ parent: null }, { parent: "R001" }],
  activity: [{ type: "session_start", actor: "ai" }],
}), [...STEPS])
assert.deepEqual(reachedSteps({ ...empty, roadmap: [{ parent: null }], activity: [{ type: "session_start", actor: "human" }] }), ["started"], "a horizon alone or a human session isn't a step")

// pending: nothing without consent
const all = [...STEPS]
assert.deepEqual(pendingSteps(EMPTY_FEEDBACK, all), [])
assert.deepEqual(pendingSteps({ consent: false, sent: [] }, all), [])
assert.deepEqual(pendingSteps({ consent: true, sent: ["started"] }, ["first-task-done", "started", "agent-connected"]), ["agent-connected", "first-task-done"])

// consent: opting in on a set-up project sends only `started`
const now = "2026-10-07T00:00:00.000Z"
const on = applyConsent(EMPTY_FEEDBACK, true, all, now)
assert.deepEqual(on, { consent: true, answeredAt: now, sent: ["agent-connected", "first-roadmap", "first-task-done"] })
assert.deepEqual(pendingSteps(on, all), ["started"])
// fresh project: everything later is sent as it happens
const fresh = applyConsent(EMPTY_FEEDBACK, true, ["started"], now)
assert.deepEqual(pendingSteps(fresh, ["started", "agent-connected"]), ["started", "agent-connected"])
// off keeps sent; back on from off skips steps reached meanwhile
const off = applyConsent(markSent(fresh, "started"), false, ["started", "agent-connected"], now)
assert.deepEqual(off.sent, ["started"])
assert.deepEqual(pendingSteps(applyConsent(off, true, ["started", "agent-connected"], now), ["started", "agent-connected", "first-roadmap"]), ["first-roadmap"])
// on again while on: nothing changes
assert.deepEqual(applyConsent(fresh, true, all, now).sent, [])
assert.deepEqual(markSent(markSent(fresh, "first-roadmap"), "started").sent, ["started", "first-roadmap"])

// the wire: only the step id
for (const s of STEPS) {
  const u = new URL(stepUrl(s))
  assert.equal(u.host, "vibedoc.goatcounter.com")
  assert.equal(u.searchParams.get("p"), `/first-run/${s}`)
  assert.equal(u.searchParams.get("e"), "true")
  assert.deepEqual([...u.searchParams.keys()], ["p", "t", "e"])
}
assert.ok(isStep("started") && !isStep("x") && !isStep(3))
console.log("first-run ok")
