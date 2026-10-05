// Browser check for R056 (Doc link graph), end to end on a fixture project. The epic's Done-when:
// opening a doc shows the docs it links to and the docs that link to it, each one click away; /graph shows
// every doc link in the repo and clicking a node opens it; vibedoc_read_doc ends with the resolved related files.
//   1. a.md: clicking the `b` link opens b.md; b.md's Linked docs panel lists a.md under Linked from.
//   2. a.md: the broken link is muted, the stale `docs/gone.md` mention is marked (not broken); hovering a link
//      shows its preview card.
//   3. /graph: a, b, c (and d) with edges; clicking a selects it and dims the unrelated d → c edge; Open → /docs.
//      Motion: a's lit edges are one solid line (no travelling glow); dragging d moves it, release springs it back to its layout point and
//      the drag doesn't select it.
//   4. /graph: "3 broken links" (no stale count: stale paths are a per-doc lint) opens a list grouped by file;
//      the far-away.md row opens long.md with the link in view.
//   5. /graph from the keyboard: `/` focuses search, Tab reaches a node, Enter selects it, Enter again opens it;
//      Esc clears the selection.
//   5b. /graph: a file with no links sits on the Unlinked shelf (click selects it, Tab reaches it after the map); search
//       Enter frames the matches, Enter / Shift+Enter step through them ("1 of 5"); every dot has a ≥ 24px hit pad;
//       every label that shows renders ≥ 9px, at the fit and zoomed out; Fit keeps the mount camera (T112).
//       Search matches labels and ids first: "docs" finds Charlie docs, not the docs/ folder; "docs/" matches paths.
//   6. /graph after a pan: an agent moving T001 pings its node and leaves the camera where the user put it.
//      Done draws hollow; the Recent chip lights what changed in the last 24h (T110) and names at least one of them.
//   8. T111: Show in graph (header and Linked docs) opens /graph on that doc with Focus 1; the card shows its keys,
//      the ? sheet a Graph section, the node is named selected; Tab to a below-the-fold link shows its preview;
//      a focused menu item's edge clears 3:1 for every accent × theme; a memory entry's Related list draws epics
//      with their StatusIcon; a failed graph load shows – on the chips, not 0.
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
// after it: a placeholder word inside a real name (user-name.md) is a real miss, [[name]] is a syntax example (drawn
// broken, not counted), and a file in a dot folder exists (neither drawn nor counted)
write("docs/long.md", `# Long\n\n${"Filler paragraph.\n\n".repeat(60)}At the end, [far](far-away.md). Also [guide](user-name.md), [[name]] and [skill](../.claude/skills/s/SKILL.md).\n`)
write(".claude/skills/s/SKILL.md", "# Skill\n")
write("docs/sub/b.md", "# Bravo\n\nBravo body text for the preview. Back to [a](../a.md).\n")
// "docs" is in Charlie's title and in every doc's folder: search matches the title, not the folder
write("docs/c.md", "# Charlie docs\n\nNo links here.\n")
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
  const linkedFrom = panel.locator("div:has(> h3:text-is('Linked from'))")
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
  const stalePaths = panel.locator("div:has(> h3:text-is('Stale paths'))")
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
  await page.waitForFunction(() => { const rf = document.querySelector(".react-flow"); return rf && !rf.classList.contains("opacity-0") && !document.querySelector("[data-unfold]") })
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
  const trigger = page.getByRole("button", { name: /^3 broken links$/ })
  await trigger.click()
  const menu = page.getByRole("menu")
  await menu.getByText("Broken links").waitFor()
  await menu.getByRole("menuitem", { name: /missing\.md/ }).waitFor()
  assert.equal(await menu.getByText(/stale|gone\.md/i).count(), 0, "no stale paths on /graph")
  await menu.getByRole("menuitem", { name: /far-away\.md/ }).click()
  await page.waitForURL(/\/docs\?doc=docs%2Flong\.md/)
  await page.locator("h1", { hasText: "Long" }).first().waitFor()
  const brokenLink = doc.locator("a[data-broken]").first()
  await brokenLink.waitFor()
  await page.waitForFunction(() => {
    const r = document.querySelector(".doc-preview a[data-broken]")?.getBoundingClientRect()
    return !!r && r.top >= 0 && r.bottom <= window.innerHeight
  })
  await page.waitForFunction(() => !new URL(location.href).searchParams.has("link"))
  assert.deepEqual(await doc.locator("a[data-broken]").allInnerTexts(), ["far", "guide", "name"], "user-name.md is real, [[name]] an example")
  assert.equal(await doc.getByRole("link", { name: "skill", exact: true }).getAttribute("data-broken"), null, "a dot-folder file is not a dead link")
  console.log("ok  /graph lists 3 broken links (user-name.md counts, [[name]] doesn't), no stale paths; the far-away.md row opens long.md scrolled to the link; the dot-folder link isn't drawn broken")

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
  // T110: selected by keyboard (focused + selected) still keeps the text-colour hairline, so it reads under any accent
  const txt = await page.evaluate(() => { const e = document.createElement("i"); e.style.color = "var(--color-txt)"; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c })
  await page.waitForFunction(([c]) => getComputedStyle(document.querySelector('.react-flow__node[data-id="docs/a.md"] .rounded-full')).boxShadow.includes(`${c} 0px 0px 0px 6px`), [txt])
  await page.keyboard.press("Escape")
  await page.waitForURL((u) => !u.searchParams.has("node"))
  await node("docs/a.md").focus()
  await page.keyboard.press("Enter")
  await page.waitForURL(/node=docs%2Fa\.md/)
  await page.keyboard.press("Enter")
  await page.waitForURL(/\/docs/)
  await page.locator("h1", { hasText: "Alpha" }).first().waitFor()
  console.log("ok  /graph by keyboard: / focuses search, Tab reaches Alpha, Enter selects (hairline kept under focus), Esc clears, Enter twice opens")

  // 5b. Unlinked shelf, search cycling and hit pads: long.md (no doc links) sits on the shelf, not the map; search Enter
  //     frames every match, Enter again steps through them in label order (Shift+Enter back) and keeps focus in search
  await page.goto(`${BASE}/graph`)
  await node("docs/a.md").waitFor()
  const shelf = page.locator("[data-shelf]")
  await shelf.getByText("Unlinked 1").waitFor()
  assert.equal(await node("docs/long.md").count(), 0, "an unlinked file is not on the map")
  await page.waitForFunction(() => !document.querySelector("[data-unfold]")) // the entrance scales dots
  for (const p of ["docs/a.md", "docs/c.md"]) {
    const hit = await node(p).locator("[data-hit]").boundingBox()
    assert.ok(hit.width >= 23.9 && hit.height >= 23.9, `${p} hit pad ${hit.width}×${hit.height}`)
  }
  // T112: Fit right after load keeps the mount camera (one fit for both), so it replays the entrance without a zoom
  //       change, and so without a label pass under it; Fit after a zoom returns to that same camera
  const view = () => page.locator(".react-flow__viewport").evaluate((el) => el.style.transform)
  const mounted = await view()
  await page.getByRole("button", { name: /fit view/i }).click()
  await page.waitForSelector("[data-unfold]")
  assert.equal(await view(), mounted, "Fit after load keeps the mount fit's camera")
  await page.getByRole("button", { name: /zoom in/i }).click()
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: /fit view/i }).click()
  await page.waitForTimeout(50)
  assert.equal(await view(), mounted, "Fit after a zoom returns to the mount fit's camera")
  await page.waitForFunction(() => !document.querySelector("[data-unfold]"))
  // T112: the shelf is reachable by keyboard: Tab from the last map node (label order) passes the zoom controls into it
  await node("docs/d.md").focus()
  for (let i = 0; i < 6 && !(await page.evaluate(() => !!document.activeElement?.closest("[data-shelf]"))); i++) await page.keyboard.press("Tab")
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-path")), "docs/long.md", "Tab reaches the Unlinked shelf after the map")
  // T112: every label that shows renders ≥ 9px, at the fit and zoomed out past the readable zoom (others fade out)
  const labelPx = () => page.evaluate(() => [...document.querySelectorAll(".react-flow__node span.truncate")].flatMap((el) => {
    let o = 1
    for (let e = el; e && e !== document.body; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
    if (o < 0.01) return []
    const r = el.getBoundingClientRect()
    // computed height, not offsetHeight: that rounds the 16.5px line box
    return [{ id: el.closest("[data-id]")?.getAttribute("data-id"), px: (11 * r.height) / parseFloat(getComputedStyle(el).height) }]
  }))
  for (const l of await labelPx()) assert.ok(l.px >= 8.95, `${l.id} label ${l.px.toFixed(2)}px at the fit`)
  await node("docs/a.md").click()
  await page.waitForURL(/node=docs%2Fa\.md/)
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /zoom out/i }).click()
  await page.waitForFunction(() => document.querySelector("[data-far=true]"))
  await page.waitForTimeout(400) // labels fade across the threshold
  const zoomedOut = await labelPx()
  assert.ok(zoomedOut.some((l) => l.id === "docs/a.md"), "the selected file keeps its label zoomed out")
  for (const l of zoomedOut) assert.ok(l.px >= 8.95, `${l.id} label ${l.px.toFixed(2)}px zoomed out`)
  await page.keyboard.press("Escape")
  await page.waitForURL((u) => !u.searchParams.has("node"))
  await shelf.getByRole("button", { name: "Doc Long, 0 links" }).click()
  await page.waitForURL(/node=docs%2Flong\.md/)
  await sel.getByText("docs/long.md").waitFor()
  await page.keyboard.press("Escape")
  await page.waitForURL((u) => !u.searchParams.has("node"))
  const count = page.locator("#graph-matches")
  // label and id first: a folder word matches the file named for it, not the folder; "/" or "." widens it to paths
  await page.fill("#graph-search", "docs")
  await count.getByText("1 match").waitFor()
  await page.fill("#graph-search", "docs/")
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
  console.log("ok  /graph: long.md on the Unlinked shelf; \"docs\" matches Charlie docs by title, not the docs/ folder; search Enter frames, then steps 1 of 5 → 2 of 5 → back; a kind filter resets the cursor; hit pads ≥ 24px; Tab reaches the shelf; Fit keeps the mount camera; every shown label ≥ 9px at the fit and zoomed out")

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
  // a task made with New task logs activity, so it shows in Recent too
  const made = await fetch(`${BASE}/api/tasks/create?root=${encodeURIComponent(fx)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Fresh one", body: "Follows T001." }), // linked, so it sits on the map, not the shelf
  })
  assert.ok(made.ok, await made.clone().text())
  const fresh = (await made.json()).task.file
  await page.waitForTimeout(1200)
  await page.locator("a[href^=\"/graph\"]").first().click()
  await page.waitForURL(/\/graph/)
  await edge("docs/d.md", "docs/sub/b.md").waitFor()
  await page.getByRole("button", { name: "Tasks" }).click()
  await node("plans/tasks/T001-x.md").waitFor()
  await page.waitForFunction(([p, c]) => getComputedStyle(document.querySelector(`.react-flow__node[data-id="${p}"] .rounded-full`)).color !== c, ["plans/tasks/T001-x.md", todoColor])
  // T110: a done task is a hollow Pencil Grey shape; T001 and d.md changed in this run, so they carry the Recent notch
  assert.equal(await node("plans/tasks/T001-x.md").locator("svg circle").first().getAttribute("fill"), "none", "a done task draws hollow")
  await node("plans/tasks/T001-x.md").locator("span.bg-accent").waitFor()
  const dimmed = (p) => node(p).locator(".rounded-full").first().evaluate((el) => el.classList.contains("opacity-25"))
  await page.getByRole("button", { name: /^Recent/ }).click()
  await page.waitForURL(/recent=1/)
  await page.waitForFunction(() => document.querySelector('.react-flow__node[data-id="docs/c.md"] .rounded-full')?.classList.contains("opacity-25"))
  assert.equal(await dimmed("plans/tasks/T001-x.md"), false, "Recent keeps a changed file lit")
  assert.equal(await dimmed("docs/d.md"), false, "Recent keeps an edited doc lit")
  assert.equal(await dimmed(fresh), false, "Recent keeps a newly created task lit")
  // Recent names what it lights: at least one changed file's label is on screen
  await page.waitForTimeout(600) // Recent frames the changed files
  const recentLabels = await page.evaluate(() => [...document.querySelectorAll(".react-flow__node [data-label]")].filter((el) => {
    const r = el.getBoundingClientRect()
    return Number(getComputedStyle(el).opacity) > 0.5 && r.height >= 9 && !el.closest(".react-flow__node").querySelector(".opacity-25")
  }).length)
  assert.ok(recentLabels >= 1, `Recent shows a label (${recentLabels})`)
  console.log("ok  T110: done T001 draws hollow; Recent lights T001, d.md and a new task, dims untouched c.md and shows a label")
  console.log("ok  back on /graph after /board: the new d → b link and T001's done colour show without a reload")

  // 8. T111: Show in graph from a doc → /graph selected on it with Focus 1 (d is 2 hops away, so it's cut)
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/a.md")}`)
  await panel.getByText("Charlie").waitFor()
  assert.equal(await panel.getByRole("link", { name: "Show in graph" }).getAttribute("href"), "/graph?node=docs%2Fa.md&focus=1")
  await page.getByRole("link", { name: "Show in graph" }).first().click()
  await page.waitForURL(/\/graph\?node=docs%2Fa\.md&focus=1/)
  await sel.getByText("docs/a.md").waitFor()
  await node("docs/sub/b.md").waitFor()
  assert.equal(await node("docs/d.md").count(), 0, "Focus 1 cuts d (two hops from a)")
  assert.match(await node("docs/a.md").getAttribute("aria-label"), /, selected$/, "the selected node is named selected")
  assert.doesNotMatch(await sel.innerText(), /←→\s*linked/, "the keys live in Help, not on the card")
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("?")
  // Help (bottom-right) pinned by ?: this page's keys, all from GRAPH_KEYS
  const help = page.getByRole("region", { name: "Help" })
  await help.getByText("Graph", { exact: true }).waitFor()
  const graphKeys = help.locator("table", { has: page.locator("caption", { hasText: /^Keys$/ }) })
  for (const k of ["/", "Tab", "↵", "o", "←→↑↓", "Esc", "↵ ⇧↵"]) await graphKeys.locator("kbd", { hasText: new RegExp(`^${k.replace(/[/?]/g, "\\$&")}$`) }).waitFor()
  await page.keyboard.press("Escape")
  await help.waitFor({ state: "detached" })
  console.log("ok  T111: Show in graph opens /graph on a.md with Focus 1; Help (?) lists the graph keys and Esc closes it; the node is named selected")

  // 8b. Tab to a link below the fold: the browser scrolls it in, and the preview still opens (and stays)
  await page.goto(`${BASE}/docs?doc=${encodeURIComponent("docs/long.md")}`)
  await doc.locator("a[data-broken]").first().waitFor()
  const far = doc.locator("a[data-broken]").first()
  assert.ok(await far.evaluate((el) => el.getBoundingClientRect().top > window.innerHeight), "far link starts below the fold")
  await doc.locator("p").first().evaluate((el) => { el.tabIndex = -1; el.focus() })
  await page.keyboard.press("Tab")
  await page.waitForFunction(() => document.activeElement?.matches(".doc-preview a[data-broken]"))
  await card.getByText("far-away.md").waitFor()
  await page.waitForTimeout(400)
  assert.ok(await card.isVisible(), "the preview stays open after the focus scroll")
  console.log("ok  T111: Tab to a below-the-fold link scrolls it in and shows its preview")

  // 8c. The broken-links menu: a keyboard-focused item's accent edge clears 3:1 against the item's fill
  await page.goto(`${BASE}/graph`)
  await page.getByRole("button", { name: /^3 broken links$/ }).focus()
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem")
  // every accent × theme (DESIGN.md: the system holds up under every combination); the fixture's own is violet dark
  const ratios = await page.evaluate(() => {
    const el = document.activeElement
    const html = document.documentElement
    const was = { dark: html.classList.contains("dark"), accent: html.getAttribute("data-accent") }
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number)
    const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
    // transition-colors would otherwise hand back a fill still fading in (transparent reads as black: a false 5.26)
    el.style.transition = "none"
    const out = {}
    for (const dark of [true, false]) {
      for (const accent of ["violet", "purple", "green", "orange"]) {
        html.classList.toggle("dark", dark)
        html.setAttribute("data-accent", accent)
        const cs = getComputedStyle(el)
        // Tailwind composes the shadow from several layers; the edge is the one that isn't transparent
        const edge = cs.boxShadow.match(/rgba?\([^)]+\)/g)?.find((c) => !/,\s*0\)$/.test(c))
        if (!/^rgb\(/.test(cs.backgroundColor)) return { [`${accent} ${dark ? "dark" : "light"} fill`]: 0, fill: cs.backgroundColor }
        const [a, b] = edge ? [lum(rgb(edge)), lum(rgb(cs.backgroundColor))].sort((x, y) => y - x) : [0, 0]
        out[`${accent} ${dark ? "dark" : "light"}`] = edge ? (a + 0.05) / (b + 0.05) : 0
      }
    }
    el.style.transition = ""
    html.classList.toggle("dark", was.dark)
    if (was.accent === null) html.removeAttribute("data-accent")
    else html.setAttribute("data-accent", was.accent)
    return out
  })
  for (const [k, r] of Object.entries(ratios)) assert.ok(r >= 3, `menu item focus edge ${k} ${r.toFixed(2)}:1`)
  await page.keyboard.press("Escape")
  console.log(`ok  T111: a focused menu item's edge clears 3:1 on its fill for every accent × theme (${Object.entries(ratios).map(([k, r]) => `${k} ${r.toFixed(2)}`).join(", ")})`)

  // 8d. A memory entry's Related list draws an epic with its StatusIcon (R002 is planned = Todo), not a flag
  write("memory/entries/E001-epic-note.md", "# E001: Epic note\n**Type:** convention\n**Updated:** 2026-10-02\n\nSee R002 and T001.\n")
  await page.goto(`${BASE}/memory?entry=E001`)
  const related = page.locator('section[aria-label="Related"]')
  const epicRow = related.getByRole("button", { name: /R002/ })
  await epicRow.waitFor()
  assert.equal(await epicRow.locator('svg[aria-label="Todo"]').count(), 1, "the epic row carries the Todo StatusIcon")
  assert.equal(await epicRow.locator("svg.lucide-flag").count(), 0, "no flag on the epic row")
  console.log("ok  T111: a memory entry's Related list draws the epic with its StatusIcon, like tasks")

  // 8e. A failed graph load keeps the toolbar, but the kind and Recent chips show "–", not 0
  await page.route("**/api/docs/graph**", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) }))
  await page.goto(`${BASE}/graph`)
  await page.getByRole("alert").getByText("Couldn't load the link graph.").waitFor()
  for (const name of ["Docs", "Tasks", "Epics", "Recent"]) {
    const chip = page.getByRole("button", { name: new RegExp(`^${name}`) })
    assert.match(await chip.innerText(), /–$/, `${name} chip shows – on a failed load`)
  }
  await page.unroute("**/api/docs/graph**")
  // the stubbed 500 is the console error this step asked for
  for (let i = errors.length - 1; i >= 0; i--) if (/status of 500/.test(errors[i])) errors.splice(i, 1)
  console.log("ok  T111: a failed graph load shows – on the kind and Recent chips, not 0")

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
