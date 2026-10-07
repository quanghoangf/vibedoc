// Browser check for R093 (doc usage signals), on a fresh fixture project with three docs:
//   1. /docs (no doc open) shows "Never read by agents" listing every doc, "Read by agents" empty (S2)
//   2. An agent reads docs/guide.md twice over /api/mcp → it moves to "Read by agents" with 2 reads, live (S1)
//   3. A human opening a doc does not count; the in-app chat's read (x-vibedoc-chat) does
//   4. .vibedoc/doc-usage.json holds the count
//   5. Agent searches that find nothing show under "Searched, not found", coalesced; a later hit removes them (S3)
//   6. Done when: after a reload, the read doc and the empty search both show
// Fails on any browser console error. The fixture is removed in `finally`.
//
//   PORT=3193 pnpm dev   # then:
//   BASE=http://localhost:3193 PW_DIR=<dir with node_modules/playwright> node e2e/doc-usage.mjs
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3193"
const fx = makeFixture()
const q = `?root=${encodeURIComponent(fx)}`
mkdirSync(path.join(fx, "docs"), { recursive: true })
writeFileSync(path.join(fx, "docs/guide.md"), "# Guide\n\nHow to deploy the widget.\n")
writeFileSync(path.join(fx, "docs/api.md"), "# API\n\nEndpoints.\n")
writeFileSync(path.join(fx, "docs/faq.md"), "# FAQ\n\nQuestions.\n")

async function mcp(name, args, headers = {}) {
  const res = await fetch(`${BASE}/api/mcp${q}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "claude-code/2.1", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}
const usageFile = () => JSON.parse(readFileSync(path.join(fx, ".vibedoc/doc-usage.json"), "utf8"))
// the MCP reply doesn't wait for the (fire-and-forget) usage write
async function eventually(check) {
  for (let i = 0; ; i++) {
    try { return check() } catch (e) { if (i > 50) throw e }
    await new Promise((r) => setTimeout(r, 100))
  }
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
  await stubChat(page, [], { root: fx })
  await page.goto(`${BASE}/docs`)
  const usage = page.getByRole("region", { name: "Doc usage by agents" })
  const read = usage.getByRole("group", { name: "Read by agents" })
  const never = usage.getByRole("group", { name: "Never read by agents" })
  await read.getByText("No agent has read a doc yet.").waitFor()
  for (const p of ["docs/api.md", "docs/faq.md", "docs/guide.md"]) await never.locator(`[data-path="${p}"]`).waitFor()
  assert.equal(await never.locator("[data-path^='plans/']").count(), 0, "tasks and epics are not docs")
  console.log("ok  S2: every doc is under Never read by agents; Read by agents is empty")

  // S1: an agent's reads show up live, counted per doc
  assert.match(await mcp("vibedoc_read_doc", { query: "docs/guide.md" }), /How to deploy/)
  await mcp("vibedoc_read_doc", { query: "docs/guide.md" })
  const row = read.locator('[data-path="docs/guide.md"]')
  await row.getByText(/^2 reads/).waitFor()
  await never.locator('[data-path="docs/guide.md"]').waitFor({ state: "detached" })
  assert.equal(usageFile().reads["docs/guide.md"].count, 2)
  console.log("ok  S1: two vibedoc_read_doc calls → docs/guide.md shows 2 reads without a reload; doc-usage.json says 2")

  // A failed read records nothing
  assert.match(await mcp("vibedoc_read_doc", { query: "docs/nope-not-here.md" }), /❌/)
  assert.deepEqual(Object.keys(usageFile().reads), ["docs/guide.md"])

  // A human opening a doc doesn't count; clicking a usage row opens the doc
  await never.getByRole("button", { name: "docs/faq.md" }).click()
  await page.getByText("Questions.").first().waitFor()
  assert.equal(usageFile().reads["docs/faq.md"], undefined, "a human open is not an agent read")
  console.log("ok  a human opening docs/faq.md (from the never-read list) does not count")

  // The in-app chat is an agent reading docs: its calls count
  await mcp("vibedoc_read_doc", { query: "docs/api.md" }, { "x-vibedoc-chat": "1" })
  await eventually(() => assert.equal(usageFile().reads["docs/api.md"]?.count, 1))
  await page.goto(`${BASE}/docs`)
  await read.locator('[data-path="docs/api.md"]').getByText(/^1 read/).waitFor()
  console.log("ok  the in-app chat's read (x-vibedoc-chat) counts as an agent read")

  // S3: a search that found nothing is listed (coalesced), and leaves once the same search finds a doc
  const notFound = usage.getByRole("group", { name: "Searched, not found" })
  await notFound.getByText("Every agent search found something.").waitFor()
  assert.match(await mcp("vibedoc_search_docs", { query: "rollback plan" }), /No results/)
  await mcp("vibedoc_search_docs", { query: "  Rollback   PLAN" })
  const miss = notFound.locator('[data-query="rollback plan"]')
  await miss.getByText(/^2 searches/).waitFor()
  assert.equal(await notFound.locator("[data-query]").count(), 1, "one entry per search, however it was typed")
  assert.equal(usageFile().searches["rollback plan"].count, 2)
  // a human search on /docs doesn't count
  await fetch(`${BASE}/api/docs${q}&q=${encodeURIComponent("nothing matches this")}`)
  assert.equal(usageFile().searches["nothing matches this"], undefined)
  writeFileSync(path.join(fx, "docs/rollback.md"), "# Rollback\n\nOur rollback plan.\n")
  assert.match(await mcp("vibedoc_search_docs", { query: "rollback plan" }), /docs\/rollback\.md/)
  await miss.waitFor({ state: "detached" })
  assert.equal(usageFile().searches["rollback plan"], undefined)
  console.log("ok  S3: two empty searches → one \"rollback plan\" entry with 2 searches, live; it leaves once the search finds docs/rollback.md")

  // Done when: after a session, /docs shows the docs the agent read and a search that found nothing
  await mcp("vibedoc_search_docs", { query: "pricing tiers" })
  await page.reload()
  await read.locator('[data-path="docs/guide.md"]').getByText(/^2 reads/).waitFor()
  await notFound.locator('[data-query="pricing tiers"]').getByText(/^1 search/).waitFor()
  console.log("ok  Done when: after a reload /docs shows the read doc and the search that found nothing")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
} finally {
  await browser.close()
  rmSync(fx, { recursive: true, force: true })
}
