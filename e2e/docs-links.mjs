// Browser check for R056 (Doc link graph), end to end on a fixture project. The epic's Done-when:
// opening a doc shows the docs it links to and the docs that link to it, each one click away; /graph shows
// every doc link in the repo and clicking a node opens it; vibedoc_read_doc ends with the resolved related files.
//   1. a.md: clicking the `b` link opens b.md; b.md's Linked docs panel lists a.md under Linked from.
//   2. a.md: the broken link is muted, the stale `docs/gone.md` mention is marked (not broken); hovering a link
//      shows its preview card.
//   3. /graph: a, b, c (and d) with edges; clicking a selects it and dims the unrelated d → c edge; Open → /docs.
//      Motion: a's lit edges are one solid line (no travelling glow); dragging d moves it, release springs it back to its layout point and
//      the drag doesn't select it.
//   4. /graph: "2 broken links" (no stale count: stale paths are a per-doc lint) opens a list grouped by file;
//      the far-away.md row opens long.md with the link in view.
//   5. /graph from the keyboard: `/` focuses search, Tab reaches a node, Enter selects it, Enter again opens it;
//      Esc clears the selection.
//   5b. /graph: a file with no links sits on the Unlinked shelf (click selects it); search Enter frames the matches,
//       Enter / Shift+Enter step through them ("1 of 5"); every dot has a ≥ 24px hit pad.
//   6. /graph after a pan: an agent moving T001 pings its node and leaves the camera where the user put it.
//   7. vibedoc_read_doc on a.md ends with a "## Related files" footer (b, c, T001, Broken missing.md,
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
write("docs/d.md", "# Delta\n\nPoints at [[c]]. Also T002.\n")
write("plans/tasks/T001-x.md", "# T001: X\n**Status:** 📋 Todo\n\n## Goal\nX.\n")
// a custom status with its own colour (blue) in the in-progress category: the dot must match the chip, not the category
write(".vibedoc/settings.json", JSON.stringify({ statuses: [{ id: "qa", label: "QA", color: "blue", category: "in-progress" }] }))
write("plans/tasks/T002-y.md", "# T002: Y\n**Status:** QA\n\n## Goal\nY.\n")

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
  const stalePaths = panel.locator("div:has(> h4:text-is('Stale paths'))")
  await stalePaths.getByRole("button", { name: /docs\/gone\.md/ }).waitFor()
  console.log("ok  broken link muted; stale path marked, not broken, and listed under Stale paths; hovering b shows its preview card")

  // 3. /graph: nodes and edges; select a dims d → c; Open goes to /docs
  await page.goto(`${BASE}/graph`)
  const node = (p) => page.locator(`.react-flow__node[data-id="${p}"]`)
  for (const p of ["docs/a.md", "docs/sub/b.md", "docs/c.md", "docs/d.md"]) await node(p).waitFor()
  const edge = (from, to) => page.locator(`.react-flow__edge[data-id="${from}->${to}"] path.react-flow__edge-path`)
  for (const [f, t] of [["docs/a.md", "docs/sub/b.md"], ["docs/a.md", "docs/c.md"], ["docs/sub/b.md", "docs/a.md"], ["docs/d.md", "docs/c.md"]]) {
    await edge(f, t).waitFor()
  }
  const opacity = (loc) => loc.evaluate((el) => Number(getComputedStyle(el).opacity))
  // the settle entrance draws edges in; read them once it's over
  await page.waitForFunction(() => { const rf = document.querySelector(".react-flow"); return rf && !rf.classList.contains("opacity-0") && !document.querySelector(".graph-edge-in, .graph-node-unfold") })
  assert.equal(await opacity(edge("docs/d.md", "docs/c.md")), 1)
  await node("docs/a.md").click()
  await page.waitForURL(/node=docs%2Fa\.md|node=docs\/a\.md/)
  const sel = page.locator('aside[aria-label="Selected file"]')
  await sel.getByText("docs/a.md").waitFor()
  // the dim fades over --duration-base, so wait for it to settle
  await edge("docs/d.md", "docs/c.md").evaluate((el) => new Promise((r) => { const t = () => (Number(getComputedStyle(el).opacity) < 0.5 ? r() : requestAnimationFrame(t)); t() }))
  assert.equal(await opacity(edge("docs/a.md", "docs/c.md")), 1, "a → c stays lit")
  console.log("ok  /graph shows a, b, c with edges; clicking a selects it and dims the unrelated d → c edge")

  // 3b. Motion: a's lit edges are one solid accent line (no glow overlay); a dragged dot springs back, unselected
  assert.equal(await page.locator(".react-flow__edge path:not(.react-flow__edge-path):not(.react-flow__edge-interaction)").count(), 0, "no overlay path on any edge")
  assert.equal(await edge("docs/a.md", "docs/c.md").evaluate((el) => getComputedStyle(el).strokeDasharray), "none", "a lit edge is a solid line")
  const dNode = node("docs/d.md")
  const at = () => dNode.evaluate((el) => el.style.transform)
  const home = await at()
  const db = await dNode.boundingBox()
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(db.x + db.width / 2 + i * 12, db.y + db.height / 2 + i * 6)
  await page.waitForFunction(([p, h]) => document.querySelector(`.react-flow__node[data-id="${p}"]`).style.transform !== h, ["docs/d.md", home])
  await page.mouse.up()
  await page.waitForFunction(([p, h]) => document.querySelector(`.react-flow__node[data-id="${p}"]`).style.transform === h, ["docs/d.md", home], { timeout: 3000 })
  assert.match(page.url(), /node=docs%2Fa\.md/, "a drag is not a click: a stays selected")
  console.log("ok  /graph: a's lit edges are solid lines; dragging d springs it back to its layout point without selecting it")
  await sel.getByRole("button", { name: "Open" }).click()
  await page.waitForURL(/\/docs/)
  await page.locator("h1", { hasText: "Alpha" }).first().waitFor()
  console.log("ok  Open goes to /docs with a.md")

  // 4. Broken / stale list on /graph; a row opens the file with the link in view
  await page.goto(`${BASE}/graph`)
  const trigger = page.getByRole("button", { name: /^2 broken links$/ })
  await trigger.click()
  const menu = page.getByRole("menu")
  await menu.getByText("Broken links").waitFor()
  await menu.getByRole("menuitem", { name: /missing\.md/ }).waitFor()
  assert.equal(await menu.getByText(/stale|gone\.md/i).count(), 0, "no stale paths on /graph")
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
  console.log("ok  /graph lists 2 broken links, no stale paths; the far-away.md row opens long.md scrolled to the link")

  // 5. Keyboard path on /graph: / → search, Tab → first node (label order: Alpha, named with its 2 visible links), Enter selects, Esc clears,
  //    Enter twice opens
  await page.goto(`${BASE}/graph`)
  await node("docs/a.md").waitFor()
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } }) // focus off the URL bar, nothing selected
  await page.keyboard.press("/")
  await page.waitForFunction(() => document.activeElement?.id === "graph-search")
  await page.keyboard.press("Tab")
  await page.waitForFunction(() => document.activeElement?.classList.contains("react-flow__node"))
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-id")), "docs/a.md")
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? ""), /^Doc Alpha, 2 links$/)
  await page.keyboard.press("Enter")
  await page.waitForURL(/node=docs%2Fa\.md/)
  await sel.getByText("docs/a.md").waitFor()
  await page.keyboard.press("Escape")
  await page.waitForURL((u) => !u.searchParams.has("node"))
  await node("docs/a.md").focus()
  await page.keyboard.press("Enter")
  await page.waitForURL(/node=docs%2Fa\.md/)
  await page.keyboard.press("Enter")
  await page.waitForURL(/\/docs/)
  await page.locator("h1", { hasText: "Alpha" }).first().waitFor()
  console.log("ok  /graph by keyboard: / focuses search, Tab reaches Alpha, Enter selects, Esc clears, Enter twice opens")

  // 5b. Unlinked shelf, search cycling and hit pads: long.md (no doc links) sits on the shelf, not the map; search Enter
  //     frames every match, Enter again steps through them in label order (Shift+Enter back) and keeps focus in search
  await page.goto(`${BASE}/graph`)
  await node("docs/a.md").waitFor()
  const shelf = page.locator("[data-shelf]")
  await shelf.getByText("Unlinked 1").waitFor()
  assert.equal(await node("docs/long.md").count(), 0, "an unlinked file is not on the map")
  await page.waitForFunction(() => !document.querySelector(".graph-node-unfold")) // the entrance scales dots
  for (const p of ["docs/a.md", "docs/c.md"]) {
    const hit = await node(p).locator("[data-hit]").boundingBox()
    assert.ok(hit.width >= 23.9 && hit.height >= 23.9, `${p} hit pad ${hit.width}×${hit.height}`)
  }
  await shelf.getByRole("button", { name: "Doc Long, 0 links" }).click()
  await page.waitForURL(/node=docs%2Flong\.md/)
  await sel.getByText("docs/long.md").waitFor()
  await page.keyboard.press("Escape")
  await page.waitForURL((u) => !u.searchParams.has("node"))
  await page.fill("#graph-search", "docs/")
  const count = page.locator("#graph-matches")
  await count.getByText("5 matches").waitFor()
  await page.press("#graph-search", "Enter")
  await page.waitForTimeout(500)
  assert.equal(await count.innerText(), "5 matches", "the first Enter frames, it doesn't select")
  await page.press("#graph-search", "Enter")
  await page.waitForURL(/node=docs%2Fa\.md/)
  await count.getByText("1 of 5").waitFor()
  await page.press("#graph-search", "Enter")
  await page.waitForURL(/node=docs%2Fsub%2Fb\.md/)
  await count.getByText("2 of 5").waitFor()
  await page.press("#graph-search", "Shift+Enter")
  await page.waitForURL(/node=docs%2Fa\.md/)
  await count.getByText("1 of 5").waitFor()
  assert.equal(await page.evaluate(() => document.activeElement?.id), "graph-search")
  // a filter change that empties the matches restarts the cursor: "0 matches", never a stale "1 of 0"
  await page.goto(`${BASE}/graph?kinds=doc,task`)
  await node("plans/tasks/T001-x.md").waitFor()
  await page.fill("#graph-search", "t00")
  await count.getByText("2 matches").waitFor()
  await page.press("#graph-search", "Enter")
  await page.press("#graph-search", "Enter")
  await count.getByText("1 of 2").waitFor()
  await page.getByRole("button", { name: /^Tasks/, pressed: true }).click()
  await count.getByText("0 matches").waitFor()
  console.log("ok  /graph: long.md on the Unlinked shelf; search Enter frames, then steps 1 of 5 → 2 of 5 → back; a kind filter resets the cursor; hit pads ≥ 24px")

  // 6. A live change after the user zoomed: the changed node flashes, the camera stays put
  await page.goto(`${BASE}/graph?kinds=doc,task`)
  await node("plans/tasks/T001-x.md").waitFor()
  await page.waitForTimeout(800) // first fit glides in
  await page.getByRole("button", { name: /zoom in/i }).click()
  await page.waitForTimeout(800)
  const camera = () => page.locator(".react-flow__viewport").evaluate((el) => el.style.transform)
  const before = await camera()
  await mcp("vibedoc_update_task", { taskId: "T001", status: "in-progress" })
  await node("plans/tasks/T001-x.md").locator("[data-changed] .graph-ping").first().waitFor()
  await page.waitForTimeout(600)
  assert.equal(await camera(), before, "the camera does not move on a live update")
  console.log("ok  a live task move pings T001 on /graph without moving the camera")

  // 6b. A custom status: the graph dot and the Selected-file chip show the same colour
  await page.goto(`${BASE}/graph?kinds=doc,task&node=${encodeURIComponent("plans/tasks/T002-y.md")}`)
  const dotColor = (p) => node(p).locator(".rounded-full").first().evaluate((el) => getComputedStyle(el).color)
  await node("plans/tasks/T002-y.md").waitFor()
  const chipColor = await sel.getByText("QA", { exact: true }).evaluate((el) => getComputedStyle(el).color)
  assert.equal(await dotColor("plans/tasks/T002-y.md"), chipColor, "custom status dot matches its chip")
  console.log("ok  a custom QA status draws the dot in the chip's own colour")

  // 6c. Changes made while the user is on another page show when they come back (no stale link cache)
  await page.goto(`${BASE}/graph?kinds=doc,task`)
  await node("plans/tasks/T001-x.md").waitFor()
  const todoColor = await dotColor("plans/tasks/T001-x.md")
  await page.locator("a[href^=\"/board\"]").first().click()
  await page.waitForURL(/\/board/)
  await mcp("vibedoc_update_task", { taskId: "T001", status: "done" })
  const put = await fetch(`${BASE}/api/docs?root=${encodeURIComponent(fx)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "docs/d.md", content: "# Delta\n\nPoints at [[c]] and [[b]]. Also T002.\n" }),
  })
  assert.ok(put.ok, await put.text())
  await page.waitForTimeout(1200)
  await page.locator("a[href^=\"/graph\"]").first().click()
  await page.waitForURL(/\/graph/)
  await edge("docs/d.md", "docs/sub/b.md").waitFor()
  await page.getByRole("button", { name: "Tasks" }).click()
  await node("plans/tasks/T001-x.md").waitFor()
  await page.waitForFunction(([p, c]) => getComputedStyle(document.querySelector(`.react-flow__node[data-id="${p}"] .rounded-full`)).color !== c, ["plans/tasks/T001-x.md", todoColor])
  console.log("ok  back on /graph after /board: the new d → b link and T001's done colour show without a reload")

  // 7. The agent's read ends with the resolved related files
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
