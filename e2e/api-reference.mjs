// Browser check for R094 (API reference from OpenAPI), on fresh fixture projects:
//   1. S1: a project with an openapi.yaml shows "API reference · 5 endpoints" in /docs; the list is grouped by tag;
//      GET /todos/{id} shows its path param and the 200 shape with the $ref'd (allOf) fields; ?api= survives a reload
//   2. S2: vibedoc_get_endpoint over /api/mcp returns the request and response shape; an unknown one lists the endpoints
//   3. S4: a project without a spec has no row, and the tool says no spec was found
// Fails on any browser console error. The fixtures are removed in `finally`.
//
//   PORT=3194 pnpm dev   # then:
//   BASE=http://localhost:3194 PW_DIR=$PWD/node_modules/.pnpm/playwright@1.63.0/node_modules node e2e/api-reference.mjs
import assert from "node:assert/strict"
import { copyFileSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3194"
const fx = makeFixture()
const bare = makeFixture()
mkdirSync(path.join(fx, "api"))
copyFileSync(new URL("./fixtures/todos-openapi.yaml", import.meta.url), path.join(fx, "api/openapi.yaml"))

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
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
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
  rmSync(fx, { recursive: true, force: true })
  rmSync(bare, { recursive: true, force: true })
}
