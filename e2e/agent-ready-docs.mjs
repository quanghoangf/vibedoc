// Check for R087 (agent-ready docs), on a fresh fixture project:
//   1. /md/<path> serves the doc as text/markdown, agent view (agent-only in, human-only out) (S2)
//   2. The page URL /docs?doc=<path> with Accept: text/markdown serves the same body (S2)
//   3. Paths outside the project, in dot-folders or not .md are refused, never read (S3)
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
} finally {
  rmSync(fx, { recursive: true, force: true })
}
