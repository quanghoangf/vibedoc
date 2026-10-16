// T546: GET /api/inbox lists what waits on the user across every hub project, newest first.
//
//   VIBEDOC_HOME=<tmp> PORT=3114 pnpm dev:next
//   VIBEDOC_HOME=<same tmp> BASE=http://localhost:3114 node e2e/inbox.mjs
import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const inbox = async (q = "") => {
  const res = await fetch(`${BASE}/api/inbox${q}`)
  assert.equal(res.status, 200)
  return res.json()
}

// A: a task in review (hand-written, so no activity time); B: a chat whose last reply asks the user something
const a = makeFixture()
writeFileSync(path.join(a, "plans/tasks/T001-review.md"), "# T001: Alpha review\n**Status:** review\n**Phase:** R002\n")
const b = makeFixture()
mkdirSync(path.join(b, ".vibedoc/chats"), { recursive: true })
const now = new Date().toISOString()
writeFileSync(path.join(b, ".vibedoc/chats/c-bravo1.json"), JSON.stringify({
  id: "c-bravo1", title: "Bravo question", sessionId: null, busy: false, notes: [], attach: null, createdAt: now, updatedAt: now,
  messages: [{ role: "user", text: "plan it", questions: [], proposals: [], plans: [] },
    { role: "assistant", text: "Which one?", questions: [{ question: "Which one?" }], proposals: [], plans: [] }],
}))
const pa = registerProject(a)
const pb = registerProject(b)

const items = (await inbox()).filter((i) => i.project.id === pa.id || i.project.id === pb.id)
assert.deepEqual(items.map((i) => [i.kind, i.project.name, i.id]), [
  ["chat-waiting", pb.name, "c-bravo1"],
  ["review", pa.name, "T001"],
])
assert.equal(items[0].href, `/chat?id=c-bravo1&project=${encodeURIComponent(pb.id)}`)
console.log("ok  review in A and waiting chat in B, B's newer chat first, each with its project")

assert.deepEqual((await inbox(`?project=${encodeURIComponent(pa.id)}`)).map((i) => i.id), ["T001"])
console.log("ok  ?project= keeps one project")

const res = await fetch(`${BASE}/api/projects/update`, {
  method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ id: pa.id, patch: { archived: true } }),
})
assert.equal(res.status, 200, await res.text())
assert.ok(!(await inbox()).some((i) => i.project.id === pa.id))
console.log("ok  archived project's items are excluded")
