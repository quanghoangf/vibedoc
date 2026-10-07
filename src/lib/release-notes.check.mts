// Self-check for src/lib/release-notes.ts: `node src/lib/release-notes.check.mts`
import assert from "node:assert/strict"
import { applyEdits } from "./diff.ts"
import { collectReleaseNotes, formatReleaseNotes, releaseNotesEdits, type NoteEpic, type NoteTask } from "./release-notes.ts"

const task = (id: string, finished: string | null, status = "done"): NoteTask => ({ id, title: `Task ${id}`, status, finished })
const tasks = [
  task("T001", "2026-09-01"), // before the tag
  task("T002", "2026-10-01"), // same day as the tag, already in the changelog
  task("T003", "2026-10-01"), // same day, new
  task("T004", "2026-10-05"),
  task("T005", "2026-10-06"), // loose
  task("T006", null), // done without a date
  task("T007", "2026-10-06", "review"),
]
const epics: NoteEpic[] = [
  { id: "R002", title: "Second", status: "in-progress", tasks: ["T004"] },
  { id: "R001", title: "First", status: "done", tasks: ["T001", "T002", "T003"] },
  { id: "R003", title: "Empty", status: "done", tasks: ["T001"] },
]
const past = "# [1.0.0](x) (2026-10-01)\n\n### Features\n\n* thing (T002) ([abc](x))\n"

const groups = collectReleaseNotes({ tasks, epics, since: "2026-10-01", changelog: past })
assert.deepEqual(groups, [
  { epic: { id: "R002", title: "Second", done: false }, tasks: [{ id: "T004", title: "Task T004" }] },
  { epic: { id: "R001", title: "First", done: true }, tasks: [{ id: "T003", title: "Task T003" }] },
  { epic: null, tasks: [{ id: "T005", title: "Task T005" }] },
])
// no tag: every dated done task not named yet
assert.deepEqual(
  collectReleaseNotes({ tasks, epics, since: null, changelog: past }).flatMap((g) => g.tasks.map((t) => t.id)),
  ["T004", "T001", "T003", "T005"],
)
// nothing new
assert.deepEqual(collectReleaseNotes({ tasks: [task("T001", "2026-09-01")], epics, since: "2026-10-01", changelog: "" }), [])

const section = formatReleaseNotes(groups, "2026-10-07")
assert.equal(
  section,
  [
    "# Unreleased (2026-10-07)", "",
    "### Second (R002) — in progress", "", "* Task T004 (T004)", "",
    "### First (R001)", "", "* Task T003 (T003)", "",
    "### Other", "", "* Task T005 (T005)", "", "",
  ].join("\n"),
)

const apply = (text: string, s: string) => {
  const r = applyEdits(text, releaseNotesEdits(text, s))
  assert.ok("content" in r, JSON.stringify(r))
  return r.content
}
// empty file
assert.equal(apply("", section), section)
// insert on top, past entries byte-for-byte
const once = apply(past, section)
assert.equal(once, section + past)
// a second draft replaces the Unreleased section, and its ids don't count as released
assert.deepEqual(collectReleaseNotes({ tasks, epics, since: "2026-10-01", changelog: once }), [], "all already drafted: nothing new")
const more = [...tasks, task("T008", "2026-10-07")]
const again = formatReleaseNotes(collectReleaseNotes({ tasks: more, epics, since: "2026-10-01", changelog: once }), "2026-10-08")
assert.ok(again.includes("T003") && again.includes("T008"))
assert.equal(apply(once, again), again + past)
// a repeated first line: the anchor grows until it is unique
const repeated = "# A\n\nx\n# A\n\ny\n"
assert.equal(apply(repeated, section), section + repeated)
// a file whose first heading isn't Unreleased keeps its preamble
const pre = "Intro\n\n# [1.0.0](x)\n"
assert.equal(apply(pre, section), section + pre)
// Unreleased only, no past entries
assert.equal(apply(section, again), again)

console.log("release-notes: ok")
