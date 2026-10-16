// Projects hub (R099): several projects in one VibeDoc, the project in the URL, last page per project.
//
//   VIBEDOC_HOME=<tmp> PORT=3101 pnpm dev:next     # the server, with a throwaway hub
//   VIBEDOC_HOME=<same tmp> BASE=http://localhost:3101 PW_DIR=<dir with playwright> node e2e/projects-hub.mjs
//
// Writes only into fresh mktemp fixture projects and the temp hub, never this repo or ~/.vibedoc.
import assert from "node:assert/strict"
import { rmSync, writeFileSync } from "node:fs"
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

const a = project("Alpha")
const b = project("Bravo")
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

  assert.deepEqual(errors, [], "no page errors")
  console.log("ok  no page errors")
} finally {
  await browser.close()
  for (const p of [a, b]) rmSync(p.root, { recursive: true, force: true })
}
