// Self-check for the desktop update card's state machine (R112 T583). Run: node src/lib/desktop-update.check.mts
import assert from "node:assert/strict"
import { NO_UPDATE, nextUpdateState as next, releasePage, type UpdateEvent, type UpdateState } from "./desktop-update.ts"

const v2 = { version: "1.25.0", notes: "n", date: null }
const v3 = { version: "1.26.0", notes: "m", date: null }
const run = (events: UpdateEvent[], s: UpdateState = NO_UPDATE) => events.reduce(next, s)

// the happy path: available → downloading (progress only goes up, capped) → ready
let s = run([{ type: "available", update: v2 }])
assert.deepEqual(s, { phase: "available", update: v2 })
s = run([{ type: "download" }, { type: "progress", percent: 41.6 }], s)
assert.deepEqual(s, { phase: "downloading", update: v2, percent: 42 })
assert.equal((run([{ type: "progress", percent: 10 }], s) as { percent: number }).percent, 42, "never goes back")
assert.equal((run([{ type: "progress", percent: 140 }], s) as { percent: number }).percent, 100)
s = run([{ type: "downloaded" }], s)
assert.deepEqual(s, { phase: "ready", update: v2 })

// the same version found again (the 6 h check) doesn't reset a download or a ready update
assert.equal(run([{ type: "available", update: v2 }], s), s)
assert.equal(run([{ type: "download" }, { type: "available", update: v2 }], { phase: "available", update: v2 }).phase, "downloading")
// a newer one does
assert.deepEqual(run([{ type: "available", update: v3 }], s), { phase: "available", update: v3 })

// an error at any step → failed (the release page), and Update again retries the download
const failed = run([{ type: "available", update: v2 }, { type: "download" }, { type: "error", message: "Code signature invalid" }])
assert.deepEqual(failed, { phase: "failed", update: v2, message: "Code signature invalid" })
assert.equal(run([{ type: "download" }], failed).phase, "downloading")

// Later hides an offer, never a download in flight or a ready update
assert.equal(run([{ type: "dismiss" }], { phase: "available", update: v2 }), NO_UPDATE)
assert.equal(run([{ type: "dismiss" }], failed), NO_UPDATE)
assert.equal(run([{ type: "dismiss" }], s).phase, "ready")

// nothing found: progress / downloaded / error change nothing
for (const e of [{ type: "progress", percent: 5 }, { type: "downloaded" }, { type: "error", message: "x" }, { type: "download" }] as UpdateEvent[]) {
  assert.equal(next(NO_UPDATE, e), NO_UPDATE)
}
assert.equal(releasePage("1.25.0"), "https://github.com/quanghoangf/vibedoc/releases/tag/v1.25.0")
console.log("desktop-update.check: ok")
