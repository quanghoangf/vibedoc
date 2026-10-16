// T545: an agent lists the hub's projects; a folder outside the hub gets an answer in words, nothing written.
//
//   VIBEDOC_HOME=<tmp> PORT=3114 pnpm dev:next
//   VIBEDOC_HOME=<same tmp> BASE=http://localhost:3114 node e2e/mcp-projects.mjs
import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"

async function rpc(root, method, params = {}) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(root)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  assert.equal(res.status, 200, `${method} → HTTP ${res.status}`)
  return (await res.json()).result
}

const a = makeFixture()
const b = makeFixture()
const pa = registerProject(a)
const pb = registerProject(b)

const list = (await rpc(a, "tools/call", { name: "vibedoc_list_projects", arguments: {} })).content[0].text
for (const p of [pa, pb]) assert.ok(list.includes(p.root) && list.includes(p.id), `${p.id} listed:\n${list}`)
assert.match(list, new RegExp(`${pa.id}.*this one`))
console.log("ok  vibedoc_list_projects lists every hub project")

// an unknown folder: the reply says how to add it, and neither the folder nor the hub changes
const unknown = mkdtempSync(path.join(tmpdir(), "vibedoc-unknown-"))
const hub = path.join(process.env.VIBEDOC_HOME, "hub.json")
const hubBefore = readFileSync(hub, "utf8")
const hubMtime = statSync(hub).mtimeMs
const r = await rpc(unknown, "tools/call", { name: "vibedoc_update_task", arguments: { taskId: "T001", status: "done" } })
assert.match(r.content[0].text, /isn't in VibeDoc yet.*npx vibedoc.*All projects/)
assert.deepEqual(readdirSync(unknown), [])
assert.equal(readFileSync(hub, "utf8"), hubBefore)
assert.equal(statSync(hub).mtimeMs, hubMtime)
console.log("ok  unknown folder → add-it text, nothing written")

assert.ok((await rpc(unknown, "tools/list")).tools.some((t) => t.name === "vibedoc_list_projects"))
assert.equal((await rpc(unknown, "initialize")).serverInfo.name, "vibedoc")
console.log("ok  initialize / tools/list still answer for an unknown folder")
