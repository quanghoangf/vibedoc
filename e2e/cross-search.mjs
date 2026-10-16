// Cross-project search (R107): one search over docs, tasks, epics and entries of every hub project or one group.
//
//   export VIBEDOC_HOME=$(mktemp -d)
//   PORT=3134 pnpm dev:next                                    # the server, with a throwaway hub
//   BASE=http://localhost:3134 PW_DIR=<dir with playwright> node e2e/cross-search.mjs
//
// Writes only into fresh mktemp fixture projects and the temp hub, never this repo or ~/.vibedoc.
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"

function project(label, files, groups = null) {
  const root = makeFixture()
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    writeFileSync(path.join(root, f), text)
  }
  if (groups) writeFileSync(path.join(root, ".vibedoc/settings.json"), JSON.stringify({ groups: ["shop"], groupNames: { shop: "Shop" } }, null, 2))
  return { root, label, ...registerProject(root) }
}

const json = async (route, init) => {
  const res = await fetch(`${BASE}${route}`, init)
  const data = await res.json()
  return { status: res.status, data }
}

async function mcp(root, args) {
  const { status, data } = await json(`/api/mcp?root=${encodeURIComponent(root)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_search_docs", arguments: args } }),
  })
  assert.equal(status, 200, JSON.stringify(data))
  return data.result.content[0].text
}

const web = project("Web", { "docs/frontend.md": "# Frontend\n\nThe web app talks to the api.\n" }, true)
const api = project("Api", {
  "docs/decisions/rate-limit.md": "# Rate limit decision\n\nWe rate limit every client to 100 requests a minute.\n",
  "plans/tasks/T001-throttle.md": "# T001: Throttle login attempts\n**Status:** todo\n**Phase:** R002\n",
  "memory/entries/E001-limits.md": "# E001: Limits live in the gateway\n**Type:** decision\n**Updated:** 2026-10-01\n\nThe rate limit is set in the gateway config.\n",
}, true)
const other = project("Other", { "docs/rate.md": "# Rate limit notes\n\nOutside the group.\n" })
const browser = await launchChrome()
const errors = []
try {
  // ── T550: GET /api/search ────────────────────────────────────────────────────
  const all = await json(`/api/search?q=${encodeURIComponent("rate limit")}&scope=all`)
  assert.equal(all.status, 200)
  const byProject = Object.fromEntries(all.data.map(g => [g.project.id, g.results]))
  assert.ok(byProject[api.id], `api has results: ${JSON.stringify(all.data)}`)
  assert.ok(byProject[other.id], "scope all includes projects outside the group")
  assert.equal(byProject[web.id], undefined, "web has no rate limit text")
  const decision = byProject[api.id].find(r => r.path === "docs/decisions/rate-limit.md")
  assert.deepEqual([decision.kind, decision.title, decision.project.id], ["doc", "Rate limit decision", api.id])
  assert.ok(byProject[api.id].some(r => r.kind === "entry" && r.id === "E001"), "entries are searched")
  assert.ok(!byProject[api.id].some(r => r.path.startsWith("memory/entries/") && r.kind === "doc"), "an entry file is not also a doc")
  console.log("ok  scope all: api's decision doc + entry, the other project too, nothing from web")

  const task = await json(`/api/search?q=throttle&scope=all`)
  const hit = task.data.find(g => g.project.id === api.id)?.results.find(r => r.id === "T001")
  assert.deepEqual([hit?.kind, hit?.title], ["task", "Throttle login attempts"])
  assert.equal(task.data.flatMap(g => g.results).filter(r => r.path.endsWith("T001-throttle.md")).length, 1, "a task file is not also a doc")
  console.log("ok  tasks are found by title, once")

  const group = await json(`/api/search?q=${encodeURIComponent("rate limit")}&scope=group:shop`)
  assert.deepEqual(group.data.map(g => g.project.id), [api.id])
  console.log("ok  scope group:shop lists only the group's projects")

  const one = await json(`/api/search?q=${encodeURIComponent("rate limit")}&scope=project:${other.id}`)
  assert.deepEqual(one.data.map(g => g.project.id), [other.id])
  assert.equal((await json(`/api/search?q=x&scope=group:nope`)).status, 404)
  assert.equal((await json(`/api/search?q=x&scope=bogus`)).status, 400)
  assert.deepEqual((await json(`/api/search?q=&scope=all`)).data, [])
  console.log("ok  scope project:<id>, unknown group 404, bad scope 400, empty query []")

  // ── T550: MCP vibedoc_search_docs scope ──────────────────────────────────────
  const text = await mcp(web.root, { query: "rate limit", scope: "group" })
  assert.match(text, new RegExp(`^\\[${api.id}\\] doc \\*\\*Rate limit decision\\*\\* — docs/decisions/rate-limit\\.md$`, "m"))
  assert.doesNotMatch(text, new RegExp(`\\[${other.id}\\]`))
  console.log("ok  MCP from web, scope group → api's decision doc, prefixed [api]")

  const plain = await mcp(web.root, { query: "web app" })
  assert.match(plain, /^🔍 "web app" — 1 file\(s\)\n\n\*\*docs\/frontend\.md\*\* \(1 hits\)\n {2}L3: The web app talks to the api\.\n$/)
  assert.equal(await mcp(web.root, { query: "rate limit" }), 'No results for "rate limit"')
  assert.match(await mcp(other.root, { query: "rate", scope: "group" }), /in no group/)
  console.log("ok  without scope: today's output, this project only; no group → says so")

  // ── T551: ⌘K "In other projects" and /search ─────────────────────────────────
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`${BASE}/board?project=${web.id}`)
  await page.locator("[data-sidebar]").first().waitFor()
  await page.keyboard.press("ControlOrMeta+k")
  const palette = page.getByRole("dialog")
  await palette.getByRole("combobox").fill("rate limit")
  const others = palette.getByRole("group", { name: "In other projects" })
  const decisionRow = others.getByRole("option", { name: /Rate limit decision/ })
  await decisionRow.waitFor()
  assert.ok((await others.getByRole("option").count()) <= 6, "max 5 results + Search all")
  for (let i = 0; i < 40 && (await decisionRow.getAttribute("aria-selected")) !== "true"; i++) await page.keyboard.press("ArrowDown")
  assert.equal(await decisionRow.getAttribute("aria-selected"), "true")
  await page.keyboard.press("Enter")
  await page.waitForURL((u) => u.pathname === "/docs" && u.searchParams.get("project") === api.id && u.searchParams.get("doc") === "docs/decisions/rate-limit.md")
  await page.getByRole("heading", { name: "Rate limit decision" }).first().waitFor()
  console.log("ok  ⌘K in web: api's doc under In other projects; Enter opens it in api")

  await page.goto(`${BASE}/search?q=${encodeURIComponent("rate limit")}&scope=group:shop&project=${web.id}`)
  await page.locator(`[data-search-project="${api.id}"]`).waitFor()
  assert.deepEqual(await page.locator("[data-search-project]").evaluateAll((els) => els.map((e) => e.getAttribute("data-search-project"))), [api.id])
  await page.getByRole("combobox", { name: "Where to search" }).selectOption("all")
  await page.locator(`[data-search-project="${other.id}"]`).waitFor()
  console.log("ok  /search: scope group lists only the group's projects; All projects adds the rest")

  await page.getByRole("searchbox", { name: "Search every project" }).fill("throttle")
  await page.getByRole("button", { name: /Throttle login attempts/ }).click()
  await page.waitForURL((u) => u.pathname === "/board" && u.searchParams.get("task") === "T001" && u.searchParams.get("project") === api.id)
  console.log("ok  a task result opens the board's task panel in its project")
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  for (const p of [web, api, other]) rmSync(p.root, { recursive: true, force: true })
}
console.log("cross-search: ok")
