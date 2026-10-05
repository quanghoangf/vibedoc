import assert from "node:assert/strict"
import { countNeedsYou, filterRows, outstanding, runClock, runIdTime, selectionLabel, sendBackNote, stepAt, stepSpans, sortRows, splitEpic, stepParts, toRow, type ReviewInput } from "./test-review.ts"

const item = (index: number, checked: boolean, auto = false) =>
  ({ index, text: `step ${index}`, checked, group: "steps" as const, auto })
const base: ReviewInput = { id: "T1", title: "One", phase: "R057 — Frontend app detection", status: "done", items: [], autoRun: null, lastRun: null, reportDate: "2026-10-01" }

assert.equal(runIdTime("20261004T074314Z"), "2026-10-04T07:43:14Z")
assert.equal(runIdTime("nope"), null)
assert.deepEqual(splitEpic("R057 — Frontend app detection"), { id: "R057", name: "Frontend app detection" })
assert.deepEqual(splitEpic(""), { id: null, name: "No epic" })

// Manual left on an unfinished task → needs me; 🤖 items stop counting once a run passed
const a = toRow({ ...base, status: "in-progress", items: [item(0, false), item(1, true), item(2, false, true)] })
assert.deepEqual([a.manual, a.left, a.needsMe, a.result], [{ done: 1, total: 2 }, 2, true, "none"])
const b = toRow({ ...base, id: "T2", items: [item(0, true), item(1, false, true)], lastRun: { runId: "20261004T074314Z", status: "passed", steps: 2, passed: 2 } })
assert.deepEqual([b.left, b.needsMe, b.result, b.at], [0, false, "passed", "2026-10-04T07:43:14Z"])
// A failed run or a task in review needs me even with nothing left to tick
const c = toRow({ ...base, id: "T3", items: [item(0, true)], autoRun: { result: "failed", date: "2026-10-02" } })
assert.deepEqual([c.left, c.needsMe, c.result], [0, true, "failed"])
const d = toRow({ ...base, id: "T4", status: "review", items: [item(0, true)] })
assert.equal(d.needsMe, true)
// Checks left on done / cancelled work: still counted, but not triage
const e = toRow({ ...base, id: "T5", items: [item(0, false)] })
assert.deepEqual([e.left, e.needsMe], [1, false])
assert.equal(toRow({ ...base, id: "T6", status: "cancelled", items: [item(0, false)] }).needsMe, false)
// A failed run on a done task still needs me
assert.equal(toRow({ ...base, id: "T7", lastRun: { runId: "20261004T074314Z", status: "failed", steps: 3, passed: 1 } }).needsMe, true)

// Sidebar badge: same rule from board tasks; tasks with neither checklist nor run never count
const mt = (untested: number, result: "passed" | "failed" | null = null) => ({ untested, autoRun: result && { result, date: "2026-10-01" } })
assert.equal(countNeedsYou([
  { status: "done", manualTests: mt(5), lastRun: null },                  // finished, checks left → no
  { status: "todo", manualTests: mt(2), lastRun: null },                  // yes
  { status: "done", manualTests: mt(0, "failed"), lastRun: null },        // yes
  { status: "done", manualTests: mt(0, "failed"), lastRun: { status: "passed" } }, // newest run passed → no
  { status: "done", manualTests: null, lastRun: { status: "failed" } },  // yes
  { status: "review", manualTests: null, lastRun: null },                 // no checklist, no run → no
  { status: "review", manualTests: mt(0), lastRun: null },                // yes
]), 4)

assert.deepEqual(sortRows([a, b, c, d]).map((r) => r.id), ["T3", "T4", "T2", "T1"])
assert.deepEqual(filterRows([a, b, c, d, e], "needs", null, "").map((r) => r.id), ["T1", "T3", "T4"])
assert.deepEqual(filterRows([a, b, c, d], "needs", null, "").map((r) => r.id), ["T1", "T3", "T4"])
assert.deepEqual(filterRows([a, b, c, d], "passed", null, "").map((r) => r.id), ["T2"])
assert.deepEqual(filterRows([a, b, c, d], "none", "R057", "t4").map((r) => r.id), ["T4"])
assert.deepEqual(filterRows([a, b, c, d], "all", "R099", "").length, 0)
console.log("ok test-review")

// Decision point: what's still open
assert.deepEqual(outstanding(a), ["2 checks unticked", "no run yet"])
assert.deepEqual(outstanding(b), ["all checks ticked", "last run passed"])
assert.deepEqual(outstanding(toRow({ ...base, lastRun: { runId: "20261004T074314Z", status: "failed", steps: 3, passed: 1 } }), 2), ["no checklist", "last run failed at step 2"])
assert.deepEqual(outstanding(c), ["all checks ticked", "last run failed"])

// Send-back note: step + first Expected/Received lines; else the error's first line; ANSI stripped
const pwError = 'expect(locator).toHaveText(expected) failed\n\nLocator:  getByRole(\'button\')\nExpected: "Nope"\nReceived: "Clicked"\nTimeout:  1000ms\n\nCall log:\n  - Expected nothing here\n'
assert.equal(sendBackNote({ index: 2, name: "Click the button", error: pwError }), 'The last run failed at step 2: Click the button\nExpected: "Nope"\nReceived: "Clicked"')
assert.equal(sendBackNote({ index: 1, name: "Open", error: "\x1b[31mTimeoutError: page.goto\x1b[39m\nmore" }), "The last run failed at step 1: Open\nTimeoutError: page.goto")
assert.equal(sendBackNote({ index: 3, name: "Save", error: null }), "The last run failed at step 3: Save")

// Checklist text: code spans without backticks, bold, emoji stripped outside code
assert.deepEqual(stepParts("Run `pnpm dev` → it starts"), [{ kind: "text", text: "Run " }, { kind: "code", text: "pnpm dev" }, { kind: "text", text: " → it starts" }])
assert.deepEqual(stepParts("⚠️ the file says **Status:** ⏸️ Paused"), [{ kind: "text", text: "the file says " }, { kind: "strong", text: "Status:" }, { kind: "text", text: " Paused" }])
assert.deepEqual(stepParts("🧪 ✅ Open `❓ Shown` now"), [{ kind: "text", text: "Open " }, { kind: "code", text: "❓ Shown" }, { kind: "text", text: " now" }])
assert.deepEqual(stepParts("plain → arrow"), [{ kind: "text", text: "plain → arrow" }])
console.log("ok stepParts")

assert.equal(runClock(53, 1200), "0:00.1")
assert.equal(runClock(0, 1200), "0:00.0")
assert.equal(runClock(1104, 1200), "0:01.1")
assert.equal(runClock(65_400, 70_000), "1:05")
assert.equal(runClock(9_940, 9_990), "0:09.9")
const spans = stepSpans([{ index: 1, startMs: 0, endMs: 53 }, { index: 2, startMs: 53, endMs: 1104 }, { index: 3, startMs: 1300, endMs: 1400 }], 1000)
assert.deepEqual(spans, [{ index: 1, start: 0, end: 53, at: 13 }, { index: 2, start: 53, end: 1000, at: 999 }, { index: 3, start: 1000, end: 1000, at: 1000 }])
assert.deepEqual(stepSpans([{ index: 1, startMs: 0, endMs: 500 }], 0), [{ index: 1, start: 0, end: 500, at: 460 }])
assert.equal(stepAt(spans, 53), 2)
assert.equal(stepAt(spans, 20), 1)
assert.equal(stepAt(stepSpans([{ index: 1, startMs: 100, endMs: 200 }], 0), 50), null)
console.log("ok player")

// Live-region line for a selection change
const sel = (o: Partial<ReviewInput>) => selectionLabel(toRow({ ...base, id: "T138", ...o }))
assert.equal(sel({ lastRun: { runId: "20261004T074314Z", status: "passed", steps: 2, passed: 2 } }), "T138 · last run passed 2/2 · no checklist")
assert.equal(sel({ items: [item(0, false), item(1, false)] }), "T138 · no run yet · 2 checks left")
assert.equal(sel({ items: [item(0, true)] }), "T138 · no run yet · all checks ticked")
console.log("ok selectionLabel")

// R063: an unverified pass keeps its unticked 🤖 items owed (needs you) and says so
{
  const u = toRow({ ...base, id: "T9", status: "review", items: [item(0, true, true), item(1, false, true)], autoRun: { result: "passed", date: "2026-10-05", unverified: 1 } })
  assert.deepEqual([u.left, u.unverified, u.needsMe], [1, 1, true])
  assert.deepEqual(outstanding(u), ["1 check unticked", "last run passed · 1 unverified"])
  // …also on a done task, where unticked checks alone wouldn't count
  assert.equal(toRow({ ...base, id: "T10", status: "done", items: [item(0, false, true)], autoRun: { result: "passed", date: "2026-10-05", unverified: 1 } }).needsMe, true)
  assert.equal(countNeedsYou([{ status: "done", manualTests: { untested: 1, autoRun: { result: "passed", date: "2026-10-05", unverified: 1 } }, lastRun: { status: "passed" } }]), 1)
  console.log("ok unverified row")
}
