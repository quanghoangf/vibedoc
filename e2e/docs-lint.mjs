// Browser check for R088 (docs quality gate), on a fixture project with one broken link, one doc without a title
// and one doc nobody links to:
//   1. S1: vibedoc_check_docs lists them grouped by file with level, rule and line; a clean file says so in one line
//   2. S2: /docs shows "1 error · 2 warnings"; clicking an issue opens that doc (a link issue reveals the link)
//   3. Fixing the link over MCP updates the line live (SSE), no reload
//   4. S3: searching words of a doc's title lists that doc first, above docs that only repeat them in the body
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3188 pnpm dev   # then:
//   BASE=http://localhost:3188 PW_DIR=node_modules/.pnpm/playwright@<v>/node_modules/playwright node e2e/docs-lint.mjs
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3188"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
mkdirSync(path.join(fx, "docs"), { recursive: true })
const guide = "# Setup guide\n\n## Install\n\nSee [the missing page](missing.md).\n"
writeFileSync(path.join(fx, "docs/guide.md"), guide)
writeFileSync(path.join(fx, "docs/notes.md"), "Notes on setup: setup, setup and the guide, guide, guide.\n\nMore setup guide talk.\n")
writeFileSync(path.join(fx, "docs/index.md"), "# Index\n\n- [Guide](guide.md)\n- [Notes](notes.md)\n")

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
  // S1: one call, grouped by file, level + rule + line
  const report = await mcp("vibedoc_check_docs", {})
  assert.match(report, /^🩺 Docs check: 1 error · 2 warnings in 3 of \d+ files/)
  assert.match(report, /\*\*docs\/guide\.md\*\*\n {2}L5 error broken-link: Link to "missing\.md" points to no file/)
  assert.match(report, /\*\*docs\/notes\.md\*\*\n {2}L1 warn no-h1:/)
  assert.match(report, /\*\*docs\/index\.md\*\*\n {2}L1 warn orphan-doc:/)
  assert.ok(report.indexOf("docs/guide.md") < report.indexOf("docs/index.md"), "files with errors first")
  assert.equal(await mcp("vibedoc_check_docs", { path: "plans/roadmap/R001-now.md" }), "✅ Docs check: no issues in 1 file")
  const api = await (await fetch(`${BASE}/api/docs/lint${q}`)).json()
  assert.deepEqual([api.errors, api.warnings], [1, 2])
  assert.deepEqual(api.issues.find((i) => i.rule === "broken-link"), {
    path: "docs/guide.md", line: 5, level: "error", rule: "broken-link", message: 'Link to "missing.md" points to no file', target: "missing.md", heading: "Install",
  })
  console.log("ok  S1: vibedoc_check_docs groups issues by file with level, rule and line; a clean file is one line")

  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/docs`)

  // S2: the line, the panel, an issue opens its doc at the link
  const lint = page.locator("[data-doc-lint]")
  const summary = lint.locator("[data-lint-summary]")
  await summary.getByText("1 error").waitFor()
  assert.equal((await summary.innerText()).trim(), "1 error · 2 warnings")
  const toggle = lint.getByRole("button", { expanded: false })
  await toggle.click()
  const issues = lint.getByRole("list", { name: "Docs check" })
  await issues.waitFor()
  assert.equal(await issues.locator("[data-lint-rule]").count(), 3)
  await issues.locator('[data-lint-rule="broken-link"]').click()
  await page.waitForURL((u) => u.searchParams.get("doc") === "docs/guide.md")
  await page.locator("#setup-guide").waitFor()
  await page.locator("a[data-broken]", { hasText: "the missing page" }).waitFor()
  await issues.locator('[data-lint-rule="no-h1"]').click()
  await page.waitForURL((u) => u.searchParams.get("doc") === "docs/notes.md")
  await page.getByText("Notes on setup", { exact: false }).first().waitFor()
  console.log("ok  S2: /docs shows 1 error · 2 warnings; clicking an issue opens that doc (the broken link revealed)")

  // Live: an agent fixes the link → the line updates without a reload
  await mcp("vibedoc_write_doc", { path: "docs/guide.md", content: guide.replace("missing.md", "notes.md") })
  await summary.getByText("0 errors").waitFor()
  assert.equal((await summary.innerText()).trim(), "0 errors · 2 warnings")
  console.log("ok  fixing the link over MCP updates the line live")

  // S3: a title search ranks the titled doc above one that only repeats the words in its body
  await page.locator("#doc-search").fill("setup guide")
  const results = page.locator("aside [data-radix-scroll-area-viewport] button")
  await page.waitForResponse((r) => r.url().includes("q=setup"))
  await results.first().waitFor()
  const found = await (await fetch(`${BASE}/api/docs${q}&q=setup%20guide`)).json()
  assert.deepEqual(found.results.map((r) => r.file).slice(0, 2), ["docs/guide.md", "docs/notes.md"])
  assert.match(await results.first().innerText(), /guide/i)
  assert.match(await results.first().innerText(), /docs/)
  console.log("ok  S3: searching a doc's title lists it first, above a doc that only repeats the words")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
