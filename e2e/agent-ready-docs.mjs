// Check for R087 (agent-ready docs), on a fresh fixture project:
//   1. /md/<path> serves the doc as text/markdown, agent view (agent-only in, human-only out) (S2)
//   2. The page URL /docs?doc=<path> with Accept: text/markdown serves the same body (S2)
//   3. Paths outside the project, in dot-folders or not .md are refused, never read (S3)
//   4. A wrong path on /md/ or vibedoc_read_doc names up to 5 similar docs, the right one first (S3)
// The fixture is removed in `finally`.
//
//   PORT=3187 pnpm dev   # then:
//   BASE=http://localhost:3187 PW_DIR=<dir with node_modules/playwright> node e2e/agent-ready-docs.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { makeFixture } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3187"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
const write = (rel, body) => { mkdirSync(path.dirname(path.join(fx, rel)), { recursive: true }); writeFileSync(path.join(fx, rel), body) }

const GUIDE = [
  "# Setup guide", "", "Install the app.",
  "<!-- agent-only Run pnpm test before you propose edits. -->",
  "<!-- human-only:start -->", "Click the big green button.", "<!-- human-only:end -->",
  "Then read [the overview](../architecture/overview.md).", "",
].join("\n")
write("docs/guides/setup.md", GUIDE)
write("docs/architecture/overview.md", "# Architecture overview\n\nSee `docs/guides/setup.md`.\n")
write(".vibedoc/secret.md", "# secret\n")
write("notes.txt", "not a doc\n")

const get = (p, headers = {}) => fetch(`${BASE}${p}`, { headers })
async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "claude-code/2.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

try {
  // 1. S2: /md/<path>
  let res = await get(`/md/docs/guides/setup.md${q}`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type") ?? "", /^text\/markdown/)
  const body = await res.text()
  assert.match(body, /Run pnpm test before you propose edits\./)
  assert.doesNotMatch(body, /big green button|human-only|agent-only/)
  assert.match(body, /^# Setup guide/)
  console.log("ok  S2: /md/<path> is text/markdown with agent-only notes and without human-only blocks")

  // 2. S2: content negotiation on the page URL
  res = await get(`/docs${q}&doc=${encodeURIComponent("docs/guides/setup.md")}`, { accept: "text/markdown" })
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type") ?? "", /^text\/markdown/)
  assert.equal(await res.text(), body)
  res = await get(`/docs${q}&doc=${encodeURIComponent("docs/guides/setup.md")}`, { accept: "text/html" })
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/)
  console.log("ok  S2: /docs?doc= with Accept: text/markdown serves the doc; a browser still gets the page")

  // 3. S3: refusals
  // fetch normalises %2E%2E segments away before sending: whatever answers, it is never a file
  res = await get(`/md/%2E%2E/%2E%2E/%2E%2E/etc/hosts${q}`)
  assert.notEqual(res.status, 200)
  // an encoded slash keeps the escape inside one segment, so it reaches the route
  for (const bad of ["/md/docs%2F..%2F..%2Fsecret.md", "/md/.vibedoc/secret.md", "/md/.vibedoc/feedback.json", "/md/notes.txt", "/md/node_modules/x.md"]) {
    res = await get(`${bad}${q}`)
    const text = await res.text()
    assert.equal(res.status, 400, `${bad} refused (${res.status}: ${text})`)
    assert.match(text, /^Refused/)
  }
  res = await get(`/docs${q}&doc=${encodeURIComponent("../../etc/passwd.md")}`, { accept: "text/markdown" })
  assert.equal(res.status, 400)
  console.log("ok  S3: outside the project, dot-folders and non-.md paths are refused")

  // 4. S3: wrong path → suggestions
  res = await get(`/md/docs/archtecture-overvew.md${q}`)
  assert.equal(res.status, 404)
  let miss = await res.text()
  assert.match(miss, /^Doc not found: docs\/archtecture-overvew\.md\n\nDid you mean:\n- \/md\/docs\/architecture\/overview\.md\?root=/)
  assert.ok(miss.split("\n").filter((l) => l.startsWith("- ")).length <= 5)
  // the suggested link works as given
  const link = miss.match(/- (\/md\/\S+)/)[1]
  assert.equal((await get(link)).status, 200)
  miss = await mcp("vibedoc_read_doc", { query: "archtecture-overvew" })
  assert.match(miss, /Doc not found: "archtecture-overvew"\. Did you mean:\n- docs\/architecture\/overview\.md/)
  console.log("ok  S3: a wrong path on /md/ and vibedoc_read_doc names the right doc first, links work")
} finally {
  rmSync(fx, { recursive: true, force: true })
}
