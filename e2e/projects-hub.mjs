// Projects hub (R099): several projects in one VibeDoc, the project in the URL, last page per project.
//
//   VIBEDOC_HOME=<tmp> PORT=3101 pnpm dev:next     # the server, with a throwaway hub
//   VIBEDOC_HOME=<same tmp> BASE=http://localhost:3101 PW_DIR=<dir with playwright> node e2e/projects-hub.mjs
//
// Writes only into fresh mktemp fixture projects and the temp hub, never this repo or ~/.vibedoc.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { launchChrome, makeFixture, registerProject } from "./stub-chat.mjs"

const BASE = process.env.BASE ?? "http://localhost:3000"

/** A fixture project with one epic and one task whose titles name it. */
function project(label) {
  const root = makeFixture()
  writeFileSync(path.join(root, "plans/roadmap/R002-epic.md"), `# R002: ${label} epic\n**Parent:** R001\n**Status:** planned\n**Order:** 10\n**Tasks:** T001\n`)
  writeFileSync(path.join(root, "plans/tasks/T001-card.md"), `# T001: ${label} card\n**Status:** todo\n**Phase:** R002\n`)
  return { root, label, ...registerProject(root) }
}

/** Every file's path and bytes under `dir`: a removed project's folder must not change at all. */
function folderHash(dir) {
  const h = createHash("sha256")
  for (const f of readdirSync(dir, { recursive: true }).map(String).sort()) {
    const full = path.join(dir, f)
    h.update(f)
    try { h.update(readFileSync(full)) } catch {} // a folder
  }
  return h.digest("hex")
}

const a = project("Alpha")
const b = project("Bravo")
const c = project("Charlie")
// R101 T536: a folder with 8 repos (one two levels down, 2 already in the hub) plus folders a scan must skip
const work = mkdtempSync(path.join(os.tmpdir(), "vibedoc-scan-"))
const repoNames = ["r1", "r2", "r3", "r4", "r5", "group/r7"]
for (const n of repoNames) mkdirSync(path.join(work, n, ".git"), { recursive: true })
for (const n of ["node_modules/dep", ".hidden", "plain/deeper/too-deep"]) mkdirSync(path.join(work, n, ".git"), { recursive: true })
mkdirSync(path.join(work, "r1/plans/tasks"), { recursive: true })
writeFileSync(path.join(work, "r1/plans/tasks/T001-scan.md"), "# T001: Scanned card\n**Status:** todo\n")
writeFileSync(path.join(work, "notes.txt"), "a file, not a folder")
const known = ["known1", "known2"].map((n) => (mkdirSync(path.join(work, n, ".git"), { recursive: true }), registerProject(path.join(work, n))))
const scannedRoots = () => JSON.parse(readFileSync(path.join(process.env.VIBEDOC_HOME, "hub.json"), "utf8")).projects.filter((p) => p.root.startsWith(work))

const errors = []
const browser = await launchChrome()
try {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  // A by URL, then a page there to remember
  await page.goto(`${BASE}/board?project=${a.id}`)
  await page.getByText("Alpha card", { exact: true }).first().waitFor()
  await page.goto(`${BASE}/roadmap?project=${a.id}`)
  await page.getByText("Alpha epic").first().waitFor()
  console.log("ok  ?project= opens that project's board and roadmap")

  // Switch to B: its board (no last page yet), the URL names B
  await page.locator("header").getByRole("button", { name: a.name }).click()
  await page.getByRole("menuitem", { name: new RegExp(b.name) }).click()
  await page.waitForURL((u) => u.pathname === "/board" && u.searchParams.get("project") === b.id)
  await page.getByText("Bravo card", { exact: true }).first().waitFor()
  assert.equal(await page.getByText("Alpha card", { exact: true }).count(), 0)
  console.log("ok  switching to B opens B's board with ?project=B")

  // Back to A: the last page used there (/roadmap) is kept
  await page.locator("header").getByRole("button", { name: b.name }).click()
  await page.getByRole("menuitem", { name: new RegExp(a.name) }).click()
  await page.waitForURL((u) => u.pathname === "/roadmap" && u.searchParams.get("project") === a.id)
  await page.getByText("Alpha epic").first().waitFor()
  console.log("ok  switching back to A reopens A's last page (/roadmap)")

  // An in-app link keeps the project; a reload stays on it
  await page.goto(`${BASE}/board?project=${b.id}`)
  await page.getByText("Bravo card", { exact: true }).first().waitFor()
  await page.getByRole("link", { name: /^Roadmap/ }).first().click()
  await page.waitForURL((u) => u.pathname === "/roadmap" && u.searchParams.get("project") === b.id)
  await page.reload()
  await page.getByText("Bravo epic").first().waitFor()
  assert.equal(await page.getByText("Alpha epic").count(), 0)
  console.log("ok  a sidebar link keeps ?project=, reload stays on B")

  // ⌘K → Switch project… opens the header switcher
  await page.keyboard.press("ControlOrMeta+k")
  await page.getByRole("option", { name: /Switch project…/ }).click()
  await page.getByRole("menuitem", { name: new RegExp(a.name) }).waitFor()
  await page.keyboard.press("Escape")
  console.log("ok  ⌘K Switch project… opens the switcher")

  // `/` opens B's last page for B
  await page.goto(`${BASE}/?project=${b.id}`)
  await page.waitForURL((u) => u.pathname === "/roadmap" && u.searchParams.get("project") === b.id)
  console.log("ok  / with ?project=B reopens B's last page")

  // A copied deep link opens B's epic in a fresh tab
  const fresh = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  fresh.on("pageerror", (e) => errors.push(e.message))
  await fresh.goto(`${BASE}/roadmap?project=${b.id}&item=R002`)
  await fresh.getByRole("button", { name: "Close R002" }).or(fresh.getByLabel(/R002/).first()).first().waitFor()
  await fresh.getByText("Bravo epic").first().waitFor()
  console.log("ok  /roadmap?project=B&item=R002 opens B's epic in a fresh tab")

  // Unknown id: the default project and a toast
  await fresh.goto(`${BASE}/board?project=no-such-project`)
  await fresh.getByText(/No project “no-such-project”/).waitFor()
  assert.equal(await fresh.getByText("Bravo card", { exact: true }).count(), 0)
  console.log("ok  unknown ?project= shows the default project and a toast")

  // An unknown ?root= is refused
  const r = await fetch(`${BASE}/api/tasks?root=${encodeURIComponent("/etc")}`)
  assert.equal(r.status, 403)
  console.log("ok  ?root= outside the hub → 403")

  // T531: All projects lists the three with their open tasks; Open switches to one
  const row = (p) => page.locator(`[data-project-row="${p.id}"]`)
  await page.goto(`${BASE}/projects?project=${a.id}`)
  for (const p of [a, b, c]) await row(p).getByText("1 open task").waitFor()
  await row(c).getByRole("button", { name: `Open ${c.name}` }).click()
  await page.waitForURL((u) => u.searchParams.get("project") === c.id)
  await page.getByText("Charlie card", { exact: true }).first().waitFor()
  console.log("ok  All projects lists three projects with open tasks; Open switches to C")

  // Rename = the switcher label, never the folder
  const renamed = `Bravo renamed ${b.id}`
  await page.goto(`${BASE}/projects?project=${c.id}`)
  await row(b).getByRole("button", { name: "Rename" }).click()
  await row(b).getByLabel(`Display name of ${b.name}`).fill(renamed)
  await row(b).getByRole("button", { name: "Save" }).click()
  await row(b).getByText(renamed).waitFor()
  await page.locator("header").getByRole("button", { name: c.name }).click()
  await page.getByRole("menuitem", { name: new RegExp(renamed) }).waitFor()
  await page.keyboard.press("Escape")
  assert.ok(existsSync(b.root), "the folder keeps its name")
  console.log("ok  rename changes the switcher label, not the folder")

  // Pin sorts first; archive leaves the switcher
  await row(b).getByRole("button", { name: "Pin" }).click()
  await page.waitForFunction((id) => document.querySelector("[data-project-row]")?.getAttribute("data-project-row") === id, b.id)
  await row(a).getByRole("button", { name: "Archive" }).click()
  await page.getByText("Archived (1)").waitFor()
  await page.reload()
  await page.getByText("Archived (1)").waitFor()
  assert.equal(await page.locator("[data-project-row]").first().getAttribute("data-project-row"), b.id)
  await page.locator("header").getByRole("button", { name: c.name }).click()
  await page.getByRole("menuitem", { name: new RegExp(renamed) }).waitFor()
  assert.equal(await page.getByRole("menuitem", { name: new RegExp(a.name) }).count(), 0)
  await page.keyboard.press("Escape")
  await page.getByText("Archived (1)").click()
  await row(a).getByRole("button", { name: "Unarchive" }).click()
  await row(a).getByRole("button", { name: "Archive" }).waitFor()
  console.log("ok  pinned sorts first, archived is hidden from the switcher")

  // Remove: row gone, folder byte-for-byte the same, Undo brings it back; the current project can't be removed
  assert.ok(await row(c).getByRole("button", { name: "Remove" }).isDisabled())
  const before = folderHash(a.root)
  await row(a).getByRole("button", { name: "Remove" }).click()
  await row(a).waitFor({ state: "detached" })
  await page.getByText(/Removed .* Its files are untouched/).waitFor()
  assert.equal(folderHash(a.root), before)
  assert.equal(JSON.parse(readFileSync(path.join(process.env.VIBEDOC_HOME, "hub.json"), "utf8")).projects.some((p) => p.id === a.id), false)
  await page.getByRole("button", { name: "Undo" }).click()
  await row(a).getByText("1 open task").waitFor()
  assert.equal(folderHash(a.root), before)
  console.log("ok  remove drops the row, the folder is unchanged, Undo restores it; current can't be removed")

  // T532: C's folder moves → Missing, the others still work; Locate refuses a file and a taken folder, then takes the new one
  const hubOf = () => readFileSync(path.join(process.env.VIBEDOC_HOME, "hub.json"), "utf8")
  const oldC = c.root
  c.root = `${oldC}-moved`
  renameSync(oldC, c.root)
  await page.goto(`${BASE}/projects?project=${a.id}`)
  await row(c).getByText("Missing", { exact: true }).waitFor()
  assert.equal((await fetch(`${BASE}/api/tasks?root=${encodeURIComponent(oldC)}`)).status, 404)
  await page.locator("header").getByRole("button", { name: a.name }).click()
  assert.ok(await page.getByRole("menuitem", { name: new RegExp(c.name) }).isDisabled())
  await page.keyboard.press("Escape")
  await row(b).getByRole("button", { name: /^Open / }).click()
  await page.waitForURL((u) => u.pathname === "/roadmap" && u.searchParams.get("project") === b.id) // B's last page
  await page.getByText("Bravo epic").first().waitFor()
  console.log("ok  a moved folder shows Missing (404 on its ?root=, disabled in the switcher); B still opens")

  await page.goto(`${BASE}/projects?project=${a.id}`)
  const entryC = () => JSON.stringify(JSON.parse(hubOf()).projects.find((p) => p.id === c.id))
  const before532 = entryC()
  await row(c).getByRole("button", { name: "Locate" }).click()
  const where = row(c).getByLabel(`New folder of ${c.name}`)
  await where.fill(path.join(c.root, "plans/tasks/T001-card.md"))
  await row(c).getByRole("button", { name: "Locate", exact: true }).click()
  await row(c).getByRole("alert").getByText(/not a folder/).waitFor()
  await where.fill(a.root)
  await row(c).getByRole("button", { name: "Locate", exact: true }).click()
  await row(c).getByRole("alert").getByText(/another project already uses/).waitFor()
  assert.equal(entryC(), before532, "a refused Locate saves nothing")
  await where.fill(c.root)
  await row(c).getByRole("button", { name: "Locate", exact: true }).click()
  await row(c).getByText("1 open task").waitFor()
  assert.equal(await row(c).getByText("Missing", { exact: true }).count(), 0)
  assert.equal(JSON.parse(hubOf()).projects.find((p) => p.id === c.id)?.root, c.root)
  await row(c).getByRole("button", { name: `Open ${c.name}` }).click()
  await page.waitForURL((u) => u.searchParams.get("project") === c.id)
  await page.getByRole("link", { name: /^Board/ }).first().click()
  await page.getByText("Charlie card", { exact: true }).first().waitFor()
  console.log("ok  Locate refuses a file and a taken folder in words, then keeps the id and loads its tasks")

  // T536 (S1): 8 repos, 2 already in the hub → 6 offered, only the ticked 5 are added
  await page.goto(`${BASE}/projects?project=${a.id}`)
  await page.getByRole("button", { name: "Add project" }).click()
  await page.getByRole("menuitem", { name: "Scan a folder" }).click()
  await page.getByLabel("Folder to scan").fill(work)
  await page.getByRole("button", { name: "Scan", exact: true }).click()
  const results = page.locator("[data-scan-results] li")
  await page.getByText("8 repos found, 6 new").waitFor()
  assert.equal(await results.count(), 8)
  for (const k of known) assert.ok(await results.filter({ hasText: k.root }).getByRole("checkbox").isDisabled())
  assert.equal(await results.filter({ hasText: "In the hub" }).count(), 2)
  assert.equal(await results.getByText(/node_modules|\.hidden|too-deep/).count(), 0, "skips node_modules, dot folders, depth 3")
  const tick = ["r1", "r2", "r3", "r4", "group/r7"]
  for (const n of tick) await results.filter({ hasText: path.join(work, n) }).getByRole("checkbox").check()
  await page.getByRole("button", { name: "Add 5 projects" }).click()
  await page.getByText("Added 5 projects").waitFor()
  const hubScanned = scannedRoots()
  assert.deepEqual(hubScanned.map((p) => p.root).sort(), [...tick.map((n) => path.join(work, n)), ...known.map((k) => k.root)].sort())
  const r1 = hubScanned.find((p) => p.root === path.join(work, "r1"))
  await row(r1).getByText("1 open task").waitFor()
  await row(hubScanned.find((p) => p.root === path.join(work, "r2"))).getByText("0 open tasks").waitFor()
  console.log("ok  scan offers new repos, greys the 2 in the hub, adds only the 5 ticked ones with task counts")

  // T536: add by path refuses a missing path and a file in words, adds a folder
  await page.getByRole("button", { name: "Add project" }).click()
  await page.getByRole("menuitem", { name: "From a folder path" }).click()
  const pathField = page.getByLabel("Folder path")
  await pathField.fill(path.join(work, "nope"))
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.getByRole("alert").getByText(/no such folder/).waitFor()
  await pathField.fill(path.join(work, "notes.txt"))
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.getByRole("alert").getByText(/not a folder/).waitFor()
  assert.equal(scannedRoots().length, 7, "a refused path adds nothing")
  await pathField.fill(path.join(work, "r5"))
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.getByText("Added 1 project").waitFor()
  await row(scannedRoots().find((p) => p.root === path.join(work, "r5"))).getByText("0 open tasks").waitFor()
  assert.equal((await fetch(`${BASE}/api/projects/add`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://evil.example" }, body: JSON.stringify({ root: work }) })).status, 403)
  console.log("ok  add by path: missing and file refused in words, a folder is added; cross-origin add → 403")

  assert.deepEqual(errors, [], "no page errors")
  console.log("ok  no page errors")
} finally {
  await browser.close()
  for (const p of [a, b, c]) rmSync(p.root, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
  // leave the hub as we found it, so a rerun against the same VIBEDOC_HOME sees only its own fixtures
  const hubFile = path.join(process.env.VIBEDOC_HOME, "hub.json")
  const hub = JSON.parse(readFileSync(hubFile, "utf8"))
  hub.projects = hub.projects.filter((p) => ![a, b, c].some((x) => x.id === p.id) && !p.root.startsWith(work))
  writeFileSync(hubFile, JSON.stringify(hub, null, 2) + "\n")
}
