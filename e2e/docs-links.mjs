// Browser check for R056 (Doc link graph), end to end on a fixture project. The epic's Done-when:
// opening a doc shows the docs it links to and the docs that link to it, each one click away; /graph shows
// every doc link in the repo and clicking a node opens it; vibedoc_read_doc ends with the resolved related files.
//   1. a.md: clicking the `b` link opens b.md; b.md's Linked docs panel lists a.md under Linked from.
//   2. a.md: the broken link is muted, the stale `docs/gone.md` mention is marked (not broken); hovering a link
//      shows its preview card.
//   3. /graph: a, b, c (and d) with edges; clicking a selects it and dims the unrelated d → c edge; Open → /docs.
//   4. /graph: "2 broken · 1 stale path" opens a list; the far-away.md row opens long.md with the link in view.
//   5. vibedoc_read_doc on a.md ends with a "## Related files" footer (b, c, T001, Broken missing.md,
//      Stale paths docs/gone.md).
// Fails on any browser console error.
//
//   PW_DIR=<dir with node_modules/playwright> BASE=http://localhost:3000 node e2e/docs-links.mjs
//
// Uses the real routes and /api/mcp (only /api/projects is stubbed); writes only a fresh mktemp fixture.
import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { launchChrome, makeFixture, stubChat } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"
const fx = makeFixture()
const write = (f, s) => {
  mkdirSync(path.dirname(path.join(fx, f)), { recursive: true })
  writeFileSync(path.join(fx, f), s)
}
write("docs/a.md", "# Alpha\n\nSee [b](sub/b.md) and [[c]].\n\nAlso [x](missing.md) and T001. Moved: `docs/gone.md`.\n")
// the filler puts its broken link below the fold, so step 4 proves it gets scrolled into view
write("docs/long.md", `# Long\n\n${"Filler paragraph.\n\n".repeat(60)}At the end, [far](far-away.md).\n`)
write("docs/sub/b.md", "# Bravo\n\nBravo body text for the preview. Back to [a](../a.md).\n")
write("docs/c.md", "# Charlie\n\nNo links here.\n")
// d → c is an edge that doesn't touch a, so selecting a must dim it
write("docs/d.md", "# Delta\n\nPoints at [[c]].\n")
write("plans/tasks/T001-x.md", "# T001: X\n**Status:** 📋 Todo\n\n## Goal\nX.\n")

async function mcp(name, args) {
  const res = await fetch(`${BASE}/api/mcp?root=${encodeURIComponent(fx)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const d = await res.json()
  return d.result?.content?.[0]?.text ?? JSON.stringify(d)
}

const browser = await launchChrome()
const errors = []
try {
  // ≥ xl, so the Linked docs panel is a column beside the preview
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  page.on("console", (m) => {
    // the app has no favicon; not this feature's concern
    if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await stubChat(page, [], { root: fx })
  const doc = page.locator(".doc-preview")
  const panel = page.locator('aside[aria-label="Linked docs"]')

  // 1. Click through a → b; b's panel lists a under Linked from
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/a.md")}`)
  await panel.getByText("Charlie").waitFor() // links data loaded
  await doc.getByRole("link", { name: "b", exact: true }).click()
  await page.locator("h1", { hasText: "Bravo" }).first().waitFor()
  const linkedFrom = panel.locator("div:has(> h4:text-is('Linked from'))")
  await linkedFrom.getByRole("button", { name: /Alpha/ }).waitFor()
  console.log("ok  clicking the b link opens b.md; its panel lists a.md under Linked from")

  // a is one click away from b's panel
  await linkedFrom.getByRole("button", { name: /Alpha/ }).click()
  await page.locator("h1", { hasText: "Alpha" }).first().waitFor()
  await panel.getByText("Charlie").waitFor()

  // 2. Broken link is muted; hovering a resolved link shows its preview
  const broken = doc.locator("a[data-broken]")
  await broken.waitFor()
  assert.equal(await broken.innerText(), "x")
  const color = (loc) => loc.evaluate((el) => getComputedStyle(el).color)
  assert.notEqual(await color(broken), await color(doc.getByRole("link", { name: "b", exact: true })), "broken link is muted")
  assert.equal(await doc.locator("a[data-broken]").count(), 1, "only missing.md is broken")
  await doc.getByRole("link", { name: "b", exact: true }).hover()
  const card = page.getByRole("tooltip")
  await card.getByText("Bravo body text for the preview").waitFor()
  await card.getByText("docs/sub/b.md").waitFor()
  await page.mouse.move(5, 5)
  await card.waitFor({ state: "hidden" })
  const staleCode = doc.locator("code[data-stale]")
  assert.equal(await staleCode.innerText(), "docs/gone.md")
  assert.equal(await staleCode.getAttribute("title"), "File not found")
  assert.equal(await doc.locator("code[data-stale]").count(), 1)
  console.log("ok  broken link muted; stale path marked, not broken; hovering b shows its preview card")

  // 3. /graph: nodes and edges; select a dims d → c; Open goes to /docs
  await page.goto(`${BASE}/graph`)
  const node = (p) => page.locator(`.react-flow__node[data-id="${p}"]`)
  for (const p of ["docs/a.md", "docs/sub/b.md", "docs/c.md", "docs/d.md"]) await node(p).waitFor()
  const edge = (from, to) => page.locator(`.react-flow__edge[data-id="${from}->${to}"] path.react-flow__edge-path`)
  for (const [f, t] of [["docs/a.md", "docs/sub/b.md"], ["docs/a.md", "docs/c.md"], ["docs/sub/b.md", "docs/a.md"], ["docs/d.md", "docs/c.md"]]) {
    await edge(f, t).waitFor()
  }
  const opacity = (loc) => loc.evaluate((el) => Number(getComputedStyle(el).opacity))
  assert.equal(await opacity(edge("docs/d.md", "docs/c.md")), 1)
  await node("docs/a.md").click()
  await page.waitForURL(/node=docs%2Fa\.md|node=docs\/a\.md/)
  const sel = page.locator('aside[aria-label="Selected file"]')
  await sel.getByText("docs/a.md").waitFor()
  assert.ok((await opacity(edge("docs/d.md", "docs/c.md"))) < 0.5, "d → c is dimmed")
  assert.equal(await opacity(edge("docs/a.md", "docs/c.md")), 1, "a → c stays lit")
  console.log("ok  /graph shows a, b, c with edges; clicking a selects it and dims the unrelated d → c edge")
  await sel.getByRole("button", { name: "Open" }).click()
  await page.waitForURL(/\/docs/)
  await page.locator("h1", { hasText: "Alpha" }).first().waitFor()
  console.log("ok  Open goes to /docs with a.md")

  // 4. Broken / stale list on /graph; a row opens the file with the link in view
  await page.goto(`${BASE}/graph`)
  const trigger = page.getByRole("button", { name: /2 broken · 1 stale path/ })
  await trigger.click()
  const menu = page.getByRole("menu")
  await menu.getByText("Broken links").waitFor()
  await menu.getByRole("menuitem", { name: /docs\/gone\.md/ }).waitFor()
  await menu.getByRole("menuitem", { name: /missing\.md/ }).waitFor()
  await menu.getByRole("menuitem", { name: /far-away\.md/ }).click()
  await page.waitForURL(/\/docs\?doc=docs%2Flong\.md/)
  await page.locator("h1", { hasText: "Long" }).first().waitFor()
  const brokenLink = doc.locator("a[data-broken]")
  await brokenLink.waitFor()
  await page.waitForFunction(() => {
    const r = document.querySelector(".doc-preview a[data-broken]")?.getBoundingClientRect()
    return !!r && r.top >= 0 && r.bottom <= window.innerHeight
  })
  await page.waitForFunction(() => !new URL(location.href).searchParams.has("link"))
  console.log("ok  /graph lists 2 broken · 1 stale path; the far-away.md row opens long.md scrolled to the link")

  // 5. The agent's read ends with the resolved related files
  const read = await mcp("vibedoc_read_doc", { query: "docs/a.md" })
  const footer = read.slice(read.indexOf("## Related files"))
  assert.ok(read.includes("## Related files"), read)
  assert.match(footer, /Links to: .*docs\/sub\/b\.md/)
  assert.match(footer, /Links to: .*docs\/c\.md/)
  assert.match(footer, /Links to: .*T001/)
  assert.match(footer, /Linked from: .*docs\/sub\/b\.md/)
  assert.match(footer, /Broken: missing\.md \(L\d+\)\n/)
  assert.match(footer, /Stale paths: docs\/gone\.md/)
  console.log("ok  vibedoc_read_doc ends with Related files: b, c, T001, Broken missing.md, Stale paths docs/gone.md")

  assert.deepEqual(errors, [], "no browser console errors")
  console.log("ok  no console errors")
  console.log(`fixture: ${fx}`)
} finally {
  await browser.close()
}
