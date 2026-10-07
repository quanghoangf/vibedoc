// Browser check for R094 (API reference from OpenAPI), on fresh fixture projects:
//   1. S1: a project with an openapi.yaml shows "API reference · 5 endpoints" in /docs; the list is grouped by tag;
//      GET /todos/{id} shows its path param and the 200 shape with the $ref'd (allOf) fields; ?api= survives a reload
//   2. S3: Try it sends GET/POST to the project's local app (a node:http stub named in the spec's servers) and shows
//      status + body; cross-site → 403, a path not in the spec → 404, a remote-only server with no local app is refused
//   3. S2: vibedoc_get_endpoint over /api/mcp returns the request and response shape; an unknown one lists the endpoints
//   4. S4: a project without a spec has no row, and the tool says no spec was found
// Fails on any browser console error. The fixtures are removed in `finally`.
//
//   PORT=3194 pnpm dev   # then:
//   BASE=http://localhost:3194 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/api-reference.mjs
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3194"

// The project's "local app": records each request, answers like the spec says
const hits = []
const app = createServer((req, res) => {
  let body = ""
  req.on("data", (c) => { body += c })
  req.on("end", () => {
    hits.push({ method: req.method, url: req.url, ...(body ? { type: req.headers["content-type"], body } : {}) })
    const json = (status, data) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)) }
    const m = req.url.match(/^\/todos\/([^/?]+)/)
    if (req.method === "GET" && m) return json(200, { id: decodeURIComponent(m[1]), title: "Write docs", done: false })
    if (req.method === "POST" && req.url === "/todos") return json(201, { id: "t2", ...JSON.parse(body || "{}"), done: false })
    json(404, { message: "not found" })
  })
})
await new Promise((r) => app.listen(0, "127.0.0.1", r))
const specText = readFileSync(new URL("./fixtures/todos-openapi.yaml", import.meta.url), "utf8")
  .replace("url: http://localhost:4010", `url: http://127.0.0.1:${app.address().port}`)

const fx = makeFixture()
const bare = makeFixture()
mkdirSync(path.join(fx, "api"))
writeFileSync(path.join(fx, "api/openapi.yaml"), specText)

async function mcp(root, name, args) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(root)}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "claude-code/2.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

const browser = await launchChrome()
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  page.on("console", (m) => {
    // The refused Try it below answers 400 on purpose; Chrome logs that as a failed resource
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico") && !m.location().url.includes("/api/openapi/try")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))

  // S1: the row, the list, one endpoint
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/docs`)
  const row = page.getByRole("button", { name: /API reference\s*5 endpoints/ })
  await row.waitFor()
  await row.click()
  const ref = page.getByRole("region", { name: "API reference" })
  await ref.getByText("Todos API 1.0.0").waitFor()
  assert.deepEqual(await ref.locator("section[data-tag]").evaluateAll((s) => s.map((x) => x.dataset.tag)), ["todos", "meta"])
  assert.equal(await ref.locator('section[data-tag="todos"] li').count(), 4)
  assert.ok(new URL(page.url()).searchParams.get("api") === "1", "?api=1 in the URL")
  console.log("ok  S1: /docs shows API reference · 5 endpoints, grouped by tag (todos, meta)")

  await ref.getByRole("button", { name: /GET\s*\/todos\/\{id\}/ }).click()
  const detail = ref.locator('[data-endpoint="GET /todos/{id}"]')
  await detail.waitFor()
  await detail.getByText("Get one todo").waitFor()
  const idRow = detail.locator("tbody tr").first()
  assert.match(await idRow.innerText(), /id\s*required\s*path\s*string\s*Todo id/)
  const ok200 = await detail.locator('[data-status="200"] pre').innerText()
  for (const field of ["title: string", 'priority?: "low" | "normal" | "high"', "id: string", "done: boolean", "subtasks?: Todo[]"]) {
    assert.ok(ok200.includes(field), `200 shape has ${field}`)
  }
  assert.match(await detail.locator('[data-status="404"]').innerText(), /No todo with that id[\s\S]*message: string/)
  assert.equal(new URL(page.url()).searchParams.get("api"), "GET /todos/{id}")
  await page.reload()
  await page.locator('[data-endpoint="GET /todos/{id}"]').waitFor()
  console.log("ok  S1: GET /todos/{id} shows the path param and the resolved 200/404 shapes; ?api= survives a reload")

  // Back to the list, then a doc closes the reference
  await page.getByRole("button", { name: "All endpoints" }).click()
  await ref.locator('section[data-tag="todos"]').waitFor()
  await page.getByRole("button", { name: "Close API reference" }).click()
  await ref.waitFor({ state: "detached" })
  assert.equal(new URL(page.url()).searchParams.get("api"), null)
  console.log("ok  All endpoints goes back to the list; Close removes ?api=")

  // S3: Try it reaches the project's local app (the spec's server is the stub on localhost)
  await page.goto(`${BASE}/docs?api=${encodeURIComponent("GET /todos/{id}")}`)
  const tryIt = page.locator('[data-endpoint="GET /todos/{id}"]')
  await tryIt.getByRole("textbox", { name: "id" }).fill("abc 1")
  await tryIt.getByRole("button", { name: "Send" }).click()
  const result = tryIt.locator("[data-try-result]")
  await result.waitFor()
  assert.match(await result.innerText(), /200 OK[\s\S]*"id": "abc 1"[\s\S]*"title": "Write docs"/)
  assert.deepEqual(hits.at(-1), { method: "GET", url: "/todos/abc%201" })
  await page.goto(`${BASE}/docs?api=${encodeURIComponent("POST /todos")}`)
  const create = page.locator('[data-endpoint="POST /todos"]')
  await create.getByRole("textbox", { name: "Body" }).fill('{"title":"New"}')
  await create.getByRole("button", { name: "Send" }).click()
  await create.locator("[data-try-result]").getByText("201 Created").waitFor()
  assert.deepEqual(hits.at(-1), { method: "POST", url: "/todos", type: "application/json", body: '{"title":"New"}' })
  console.log("ok  S3: Try it sends GET /todos/{id} and POST /todos to the local app and shows status + body")

  // Refusals: a cross-site POST, a path not in the spec, a remote-only spec without a local app
  const tryUrl = `${BASE}/api/openapi/try?root=${encodeURIComponent(fx)}`
  const tryPost = (body, headers = {}) => fetch(tryUrl, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })
  assert.equal((await tryPost({ method: "GET", path: "/todos" }, { origin: "http://evil.example" })).status, 403)
  assert.equal((await tryPost({ method: "GET", path: "/admin" })).status, 404)
  const before = hits.length
  writeFileSync(path.join(fx, "api/openapi.yaml"), specText.replace(/url: http:\/\/127\.0\.0\.1:\d+/, "url: https://api.example.com"))
  await page.goto(`${BASE}/docs?api=${encodeURIComponent("GET /todos")}`)
  const remote = page.locator('[data-endpoint="GET /todos"]')
  await remote.getByRole("button", { name: "Send" }).click()
  await remote.getByRole("alert").getByText(/Try it only calls the project's local app/).waitFor()
  assert.equal(hits.length, before, "nothing sent for a remote-only spec")
  writeFileSync(path.join(fx, "api/openapi.yaml"), specText)
  console.log("ok  S3: cross-site → 403, unknown path → 404, a remote server with no local app is refused and nothing is sent")

  // S2: the agent's view of the same endpoint
  const get = await mcp(fx, "vibedoc_get_endpoint", { method: "GET", path: "/todos/{id}" })
  assert.match(get, /^## GET \/todos\/\{id\}/)
  assert.match(get, /- `id` \(path, required\): string — Todo id/)
  assert.match(get, /#### 200 — The todo\n`application\/json`\n```ts\n\{\n  title: string/)
  const post = await mcp(fx, "vibedoc_get_endpoint", { method: "post", path: "/todos" })
  assert.match(post, /### Request body \(required\)\n`application\/json`\n```ts\n\{\n  title: string\n  priority\?: "low" \| "normal" \| "high"\n\}/)
  const unknown = await mcp(fx, "vibedoc_get_endpoint", { method: "GET", path: "/nope" })
  assert.match(unknown, /^No endpoint GET \/nope\.\n\n## Todos API 1\.0\.0 \(api\/openapi\.yaml\)\n\n- GET \/todos — List todos/)
  console.log("ok  S2: vibedoc_get_endpoint returns params, request body and response shapes; an unknown endpoint lists them all")

  // S4: no spec
  const page2 = await context.newPage()
  page2.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page2, [], { root: bare })
  const listed = page2.waitForResponse((r) => r.url().includes("/api/openapi"))
  await page2.goto(`${BASE}/docs`)
  assert.deepEqual(await (await listed).json(), { path: null })
  await page2.waitForLoadState("networkidle")
  assert.equal(await page2.getByRole("button", { name: /API reference/ }).count(), 0, "no row without a spec")
  assert.match(await mcp(bare, "vibedoc_get_endpoint", {}), /^No OpenAPI spec found/)
  await page2.close()
  console.log("ok  S4: no spec → no row in /docs, and the tool says no spec was found")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  app.close()
  rmSync(fx, { recursive: true, force: true })
  rmSync(bare, { recursive: true, force: true })
}
