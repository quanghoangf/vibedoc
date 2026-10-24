// Browser check for eager and lazy doc folders, on a fixture project (not a git repo, so the glob path runs):
//   1. /api/docs lists only root .md files and docs/, plans/, memory/; ?folders=1 names the other folders with counts;
//      ?dir= lists one of them and refuses eager, dependency and nested names; build and dependency folders never show
//   2. A search and a loose doc name are questions: they find a doc inside a lazy folder
//   3. vibedoc_list_docs names the other folders at the end, and lists one with `dir`
//   4. Lint reads only the eager docs, and a link into a lazy folder is not broken
//   5. /docs shows "Other folders"; clicking one loads its docs into the tree and opens a doc;
//      a live doc update keeps the opened folder
//   6. /start: docs only in a lazy folder → "Generate roadmap from your docs"; a changelog-only folder → plan with the agent
// Fails on any browser console error. The fixtures are removed in `finally`.
//
//   PORT=3194 pnpm dev   # then:
//   BASE=http://localhost:3194 PW_DIR=<dir with node_modules/playwright> node e2e/lazy-folders.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3194"
const write = (root, f, s) => {
  mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
  writeFileSync(path.join(root, f), s)
}

const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
write(fx, "README.md", "# Readme\n\nSee [the net design](crates/net/DESIGN.md).\n")
write(fx, "docs/a.md", "# Alpha\n\nHello.\n")
write(fx, "crates/net/DESIGN.md", "# Net design\n\nThe handshake sends a nonce first.\n")
write(fx, "crates/net/README.md", "# Net\n")
write(fx, "notes/todo.md", "# Todo\n")
write(fx, "packages/ui/CHANGELOG.md", "# Changelog\n")
write(fx, "target/debug/build/x/README.md", "# Build output\n")
write(fx, "node_modules/pkg/README.md", "# Pkg\n")
write(fx, "docs/node_modules/dep/README.md", "# Dep\n")

// docs only in a lazy folder / a folder with only a changelog (welcome choice)
const fxWiki = makeFixture()
write(fxWiki, "wiki/guide.md", "# Guide\n")
const fxLog = makeFixture()
write(fxLog, "packages/ui/CHANGELOG.md", "# Changelog\n")
// the welcome is for projects with nothing planned: /start sends one with a roadmap to the board (welcomeTarget)
for (const f of [fxWiki, fxLog]) rmSync(path.join(f, "plans/roadmap"), { recursive: true, force: true })

const get = async (root, query) => {
  const res = await fetch(`${BASE}/api/docs?root=${encodeURIComponent(root)}${query}`)
  return { status: res.status, body: await res.json() }
}
async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
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
  // 1. API: eager list, lazy names, one folder on request
  const eager = (await get(fx, "")).body.map((d) => d.path)
  assert.deepEqual(eager.filter((p) => !p.startsWith("plans/")), ["README.md", "docs/a.md"])
  assert.deepEqual((await get(fx, "&folders=1")).body, [
    { name: "crates", count: 2, hasDocs: true },
    { name: "notes", count: 1, hasDocs: true },
    { name: "packages", count: 1, hasDocs: false },
  ])
  assert.deepEqual((await get(fx, "&dir=crates")).body.map((d) => d.path), ["crates/net/DESIGN.md", "crates/net/README.md"])
  for (const bad of ["docs", "node_modules", "..", "crates/net", ".vibedoc"]) {
    const r = await get(fx, `&dir=${encodeURIComponent(bad)}`)
    assert.equal(r.status, 400, `?dir=${bad} is refused`)
    assert.match(r.body.error, /^Refused/)
  }
  console.log("ok  /api/docs: root + docs/ + plans/ only; ?folders=1 names crates (2), notes (1), packages (1); ?dir=crates lists it; eager, dependency and nested names refused")

  // 2. a search and a loose name are questions: they reach into the lazy folders
  assert.deepEqual((await get(fx, "&q=handshake%20nonce")).body.results.map((r) => r.file), ["crates/net/DESIGN.md"])
  const read = await mcp("vibedoc_read_doc", { query: "DESIGN" })
  assert.match(read, /The handshake sends a nonce first/)
  assert.match(read, /1 inbound link/, "a lazy doc read over MCP joins the graph: README links to it")
  console.log("ok  a search and a loose doc name find crates/net/DESIGN.md")

  // 3. the MCP list: eager docs, then the other folders by name; `dir` lists one
  const listed = await mcp("vibedoc_list_docs", {})
  assert.match(listed, /docs\/a\.md/)
  assert.doesNotMatch(listed, /crates\/net|target|node_modules/)
  assert.match(listed, /Other folders, not read until asked .*crates\/ \(2\), notes\/ \(1\), packages\/ \(1\)/)
  assert.match(await mcp("vibedoc_list_docs", { dir: "crates" }), /crates\/net\/DESIGN\.md/)
  assert.match(await mcp("vibedoc_list_docs", { dir: "docs" }), /Refused/)
  console.log("ok  vibedoc_list_docs ends with the other folders; { dir: \"crates\" } lists it; { dir: \"docs\" } is refused")

  // 4. lint: eager docs only, and README's link into crates/ is not broken
  const lint = await (await fetch(`${BASE}/api/docs/lint${q}`)).json()
  assert.ok(!lint.issues.some((i) => i.path.startsWith("crates/") || i.path.startsWith("notes/")), "lazy docs are not linted")
  assert.ok(!lint.issues.some((i) => i.rule === "broken-link"), "a link into a lazy folder is not broken")
  console.log("ok  lint reads the eager docs only; README's link to crates/net/DESIGN.md is not broken")

  // 5. /docs: Other folders → click → its docs join the tree
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  // links=1: the Linked docs rail open (closed by default)
  await page.goto(`${BASE}/docs?links=1`)
  const others = page.locator("[data-lazy-folders]")
  await others.getByText("Other folders").waitFor()
  assert.deepEqual(await others.locator("[data-lazy-folder]").evaluateAll((els) => els.map((e) => e.dataset.lazyFolder)), ["crates", "notes", "packages"])
  // the docs list (the Linked docs panel is an aside too)
  const tree = page.locator("aside", { has: page.locator("[data-lazy-folders]") })
  assert.equal(await tree.getByRole("button", { name: "Net design", exact: true }).count(), 0, "crates is not read before the click")
  await others.getByRole("button", { name: "Open crates: 2 Markdown files" }).click()
  await others.locator('[data-lazy-folder="crates"]').waitFor({ state: "detached" })
  await tree.getByRole("button", { name: "Net design", exact: true }).click()
  await page.locator("h1", { hasText: "Net design" }).first().waitFor()
  // an opened lazy doc has links: README (eager) links to it
  const panel = page.locator('aside[aria-label="Linked docs"]')
  await panel.locator('[data-preview-path="README.md"]').waitFor()
  console.log("ok  /docs lists Other folders; clicking Crates loads its docs into the tree and opens Design; its Linked docs show README")

  // a live doc update refetches the list: the opened folder stays
  await fetch(`${BASE}/api/docs${q}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "docs/a.md", properties: { priority: "P1" } }),
  })
  await tree.getByText("P1").first().waitFor()
  assert.equal(await tree.getByRole("button", { name: "Net design", exact: true }).count(), 1, "crates stays open after a refetch")
  assert.equal(await others.locator('[data-lazy-folder="crates"]').count(), 0)
  console.log("ok  a live doc update keeps the opened folder's docs in the tree")

  // 6. /start: the welcome counts docs in lazy folders, not a changelog
  const welcome = await context.newPage()
  welcome.on("pageerror", (e) => errors.push(e.message))
  await stubChat(welcome, [], { root: fxWiki })
  await welcome.goto(`${BASE}/start`)
  await welcome.getByRole("button", { name: "Generate roadmap from your docs" }).waitFor()
  const welcomeLog = await context.newPage()
  welcomeLog.on("pageerror", (e) => errors.push(e.message))
  await stubChat(welcomeLog, [], { root: fxLog })
  await welcomeLog.goto(`${BASE}/start`)
  await welcomeLog.getByRole("button", { name: "Plan the first epics with the agent" }).waitFor()
  console.log("ok  /start: docs only in wiki/ → Generate roadmap from your docs; only a changelog → Plan the first epics")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  for (const f of [fx, fxWiki, fxLog]) rmSync(f, { recursive: true, force: true })
}
