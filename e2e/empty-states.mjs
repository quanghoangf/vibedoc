// Browser check for R083 (teaching empty states) on a truly empty project (no plans/, docs/, memory/):
//   1. Every page in PAGES shows a `[data-empty-state]` with a "what fills this" line and exactly one
//      `[data-empty-action]` (a button, a link or a /vibedoc:* command to copy).
//   2. `agent: true` pages say the agent isn't connected (`[data-connect-hint]`, link to Connect) until an agent
//      has called VibeDoc; after one MCP call (vibedoc_read_memory logs an `ai` session_start) the line is gone.
//   3. The same in Vietnamese (cookie vibedoc-lang=vi): the empty state text differs from the English one.
// `expect` (optional) checks page-specific text, e.g. which command the action copies. Each R083 task adds its pages.
// Fails on any browser console error. The fixtures are removed in `finally`.
//
//   BASE=http://localhost:3083 PW_DIR=<dir with node_modules/playwright> node e2e/empty-states.mjs
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { launchChrome } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3083"

/** @type {{ path: string, name: string, agent?: boolean, command?: string, href?: RegExp }[]} */
const PAGES = [
  { path: "/board", name: "board", agent: true, command: "/vibedoc:roadmap" },
  { path: "/roadmap", name: "roadmap", agent: true, command: "/vibedoc:roadmap" },
  { path: "/graph", name: "graph" },
  { path: "/docs", name: "docs" },
  { path: "/explorer", name: "explorer" },
  { path: "/memory", name: "memory", agent: true },
  { path: "/memory?view=graph", name: "memory graph", agent: true },
  // no agent yet: the action itself is Connect
  { path: "/activity", name: "activity", href: /connect/ },
  { path: "/chat", name: "chat" },
]

const browser = await launchChrome()
const errors = []
const empty = mkdtempSync(path.join(tmpdir(), "vibedoc-empty-"))
const withEpic = mkdtempSync(path.join(tmpdir(), "vibedoc-empty-"))
mkdirSync(path.join(withEpic, "plans/roadmap"), { recursive: true })
writeFileSync(path.join(withEpic, "plans/roadmap/R001-now.md"), "# R001: Now\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n")
writeFileSync(path.join(withEpic, "plans/roadmap/R002-epic.md"), "# R002: Epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** —\n")

async function open(root, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.addCookies([{ name: "vibedoc-lang", value: lang, url: BASE }])
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE })
  const page = await ctx.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await page.route("**/api/projects", (route) => route.fulfill({ json: [{ id: "fixture", name: "fixture", root, hasVibedoc: true }] }))
  return { ctx, page }
}

/** The page's empty state: its text, how many actions it has, and whether it shows the connect line. */
async function emptyState(page, p) {
  await page.goto(`${BASE}${p.path}`)
  const state = page.locator("[data-empty-state]")
  await state.first().waitFor()
  await page.waitForLoadState("networkidle")
  assert.equal(await state.count(), 1, `${p.name}: one empty state`)
  const actions = state.locator("[data-empty-action]")
  // the action may arrive after a fetch (the board asks the roadmap which command fits)
  await actions.first().waitFor()
  assert.equal(await actions.count(), 1, `${p.name}: exactly one primary action`)
  return {
    text: (await state.innerText()).replace(/\s+/g, " ").trim(),
    action: (await actions.innerText()).trim(),
    hint: await state.locator("[data-connect-hint]").count(),
  }
}

try {
  const texts = {}
  for (const lang of ["en", "vi"]) {
    const { ctx, page } = await open(empty, lang)
    for (const p of PAGES) {
      const s = await emptyState(page, p)
      assert.ok(s.text.length > 60, `${p.name} (${lang}): a "what fills this" line, got "${s.text}"`)
      if (p.href) assert.match(await page.locator("[data-empty-action] a").getAttribute("href"), p.href, `${p.name}: the action links to ${p.href}`)
      if (p.command) assert.ok(s.action.includes(p.command), `${p.name}: the action is ${p.command}, got "${s.action}"`)
      assert.equal(s.hint, p.agent ? 1 : 0, `${p.name} (${lang}): connect line ${p.agent ? "shown" : "not shown"} with no agent`)
      if (p.agent) {
        const href = await page.locator("[data-connect-hint] a").getAttribute("href")
        assert.match(href, /connect/i, `${p.name}: the connect line links to Connect`)
      }
      texts[`${p.name}:${lang}`] = s.text
      console.log(`ok  ${p.name} (${lang}): what-fills-this line, one action${p.agent ? ", connect line" : ""}`)
    }
    await ctx.close()
  }
  for (const p of PAGES) assert.notEqual(texts[`${p.name}:en`], texts[`${p.name}:vi`], `${p.name}: Vietnamese differs from English`)

  // The board's command follows the roadmap: an epic to break down → /vibedoc:breakdown
  {
    const { ctx, page } = await open(withEpic, "en")
    const s = await emptyState(page, { path: "/board", name: "board with an epic" })
    assert.ok(s.action.includes("/vibedoc:breakdown"), `board with an epic: /vibedoc:breakdown, got "${s.action}"`)
    await page.locator("[data-empty-action]").getByRole("button", { name: /Copy/ }).click()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "/vibedoc:breakdown", "the copy button copies the command")
    console.log("ok  board with an epic: copies /vibedoc:breakdown")
    await ctx.close()
  }

  // An agent call → the connect lines are gone
  const mcp = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(empty)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vibedoc_read_memory", arguments: {} } }),
  })
  assert.ok(mcp.ok, "MCP call")
  {
    const { ctx, page } = await open(empty, "en")
    for (const p of PAGES.filter((p) => p.agent)) {
      const s = await emptyState(page, p)
      assert.equal(s.hint, 0, `${p.name}: no connect line once an agent has called`)
      console.log(`ok  ${p.name}: connect line gone after an agent call`)
    }
    await ctx.close()
  }

  assert.deepEqual(errors, [], "no console errors")
} finally {
  await browser.close()
  rmSync(empty, { recursive: true, force: true })
  rmSync(withEpic, { recursive: true, force: true })
}
